using DeathNote.AuditTrail;
using DeathNote.Infrastructure;
using DeathNote.Lifecycle;
using DeathNote.Notifications;
using DeathNote.Owners;
using DeathNote.Trustees;
using DeathNote.Vaults;
using Microsoft.Extensions.Options;
using Volo.Abp;
using Volo.Abp.BlobStoring;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Domain.Services;

namespace DeathNote.Releases;

/// <summary>
/// [Cũ — không còn được kích hoạt] Quy trình mở vault thủ công: khởi tạo → đồng thuận → thẩm định → chờ cuối →
/// phát hành. Luồng hiện hành là TỰ ĐỘNG theo thời gian (xem <see cref="LifecycleManager"/>): hết ân hạn thì bàn giao
/// luôn, không còn trustee khởi tạo hay đồng thuận m-of-n. Phần còn lại ở đây chỉ để xử lý nốt các yêu cầu đang dở
/// (nếu có) và dọn bằng chứng cũ.
/// </summary>
public class ReleaseManager : DomainService
{
    private readonly IRepository<ReleaseRequest, Guid> _releases;
    private readonly IRepository<OwnerProfile, Guid> _owners;
    private readonly IRepository<Trustee, Guid> _trustees;
    private readonly IRepository<Vault, Guid> _vaults;
    private readonly IBlobContainer<EvidenceContainer> _evidenceBlobs;
    private readonly LifecyclePolicy _policy;
    private readonly AuditTrailManager _audit;
    private readonly INotificationSender _notifier;
    private readonly NotificationTemplates _templates;
    private readonly CheckInLinkService _links;
    private readonly IRequestContext _request;
    private readonly DeathNoteAppUrlOptions _urls;

    public ReleaseManager(
        IRepository<ReleaseRequest, Guid> releases,
        IRepository<OwnerProfile, Guid> owners,
        IRepository<Trustee, Guid> trustees,
        IRepository<Vault, Guid> vaults,
        IBlobContainer<EvidenceContainer> evidenceBlobs,
        LifecyclePolicy policy,
        AuditTrailManager audit,
        INotificationSender notifier,
        CheckInLinkService links,
        IRequestContext request,
        IOptions<DeathNoteAppUrlOptions> urls,
        NotificationTemplates templates)
    {
        _releases = releases;
        _owners = owners;
        _trustees = trustees;
        _vaults = vaults;
        _evidenceBlobs = evidenceBlobs;
        _policy = policy;
        _audit = audit;
        _notifier = notifier;
        _templates = templates;
        _links = links;
        _request = request;
        _urls = urls.Value;
    }

    /// <summary>Đồng bộ trạng thái owner + thông báo sau khi admin bỏ phiếu.</summary>
    public async Task AfterVoteAsync(ReleaseRequest request, ReviewVote vote)
    {
        var now = Clock.Now;
        var owner = await _owners.GetAsync(request.OwnerId);
        var trustees = await _trustees.GetListAsync(t => t.OwnerId == owner.Id && t.Status == TrusteeStatus.Confirmed);

        await _audit.RecordAsync(new AuditEntry(AuditActions.ReviewVoteCast, owner.Id, ActorType: AuditActorType.Admin,
            ActorUserId: vote.AdminUserId, ActorName: vote.AdminName, TargetType: nameof(ReleaseRequest), TargetId: request.Id.ToString(),
            Detail: $"Vòng {vote.Round}, phiếu {vote.Stage}: {vote.Decision}"));

        switch (request.Status)
        {
            case ReleaseStatus.FinalWait:
                owner.EnterFinalWait(now);
                await _audit.RecordAsync(new AuditEntry(AuditActions.ReleaseFinalWaitStarted, owner.Id,
                    TargetType: nameof(ReleaseRequest), TargetId: request.Id.ToString(), Detail: $"Chờ tới {request.FinalWaitUntil:O}"));
                var (s, b) = await _templates.OwnerFinalWarningAsync(owner.DisplayName, request.FinalWaitUntil!.Value, CheckInLink(owner));
                await _notifier.SendAsync(new NotificationMessage(owner.DisplayName, owner.Email, owner.PhoneNumber, s, b, NotificationChannels.All));
                break;

            case ReleaseStatus.Rejected:
                owner.ReturnToGrace(now);
                await _audit.RecordAsync(new AuditEntry(AuditActions.ReleaseRejected, owner.Id,
                    TargetType: nameof(ReleaseRequest), TargetId: request.Id.ToString(), Detail: request.CloseNote));
                foreach (var t in trustees)
                {
                    var (s2, b2) = await _templates.TrusteeRejectedAsync(t.DisplayName, owner.DisplayName, request.CloseNote, _urls.AppUrl);
                    await _notifier.SendAsync(new NotificationMessage(t.DisplayName, t.Email, t.PhoneNumber, s2, b2));
                }
                break;

            case ReleaseStatus.NeedsMoreInfo:
                foreach (var t in trustees.Where(t => t.Role == TrusteeRole.Reminder))
                {
                    var (s3, b3) = await _templates.TrusteeNeedsInfoAsync(t.DisplayName, owner.DisplayName, request.InfoRequestNote, _urls.AppUrl);
                    await _notifier.SendAsync(new NotificationMessage(t.DisplayName, t.Email, t.PhoneNumber, s3, b3));
                }
                break;
        }
        await _owners.UpdateAsync(owner);
    }

    /// <summary>Hết thời gian chờ cuối mà owner không phủ quyết → phát hành. Gọi bởi worker.</summary>
    public async Task CompleteAsync(ReleaseRequest request)
    {
        var now = Clock.Now;
        var owner = await _owners.GetAsync(request.OwnerId);
        request.Complete(now);
        owner.MarkReleased(now);
        await _releases.UpdateAsync(request);
        await _owners.UpdateAsync(owner);

        await _audit.RecordAsync(new AuditEntry(AuditActions.ReleaseCompleted, owner.Id,
            TargetType: nameof(ReleaseRequest), TargetId: request.Id.ToString(), Detail: "Mảnh khoá đã được phát cho người được uỷ quyền"));

        foreach (var t in await _trustees.GetListAsync(t => t.OwnerId == owner.Id && t.Role == TrusteeRole.Recipient && t.Status == TrusteeStatus.Confirmed))
        {
            var (s, b) = await _templates.TrusteeReleasedAsync(t.DisplayName, owner.DisplayName, _urls.AppUrl);
            await _notifier.SendAsync(new NotificationMessage(t.DisplayName, t.Email, t.PhoneNumber, s, b,
                NotificationChannels.Email | NotificationChannels.Sms));
        }
    }

    /// <summary>Xoá tệp bằng chứng của hồ sơ đã đóng quá thời hạn lưu trữ (giữ metadata cho audit).</summary>
    public async Task PurgeEvidenceAsync(ReleaseRequest request)
    {
        foreach (var e in request.Evidence.Where(e => e.PurgedAt == null))
        {
            await _evidenceBlobs.DeleteAsync(e.BlobName);
        }
        request.MarkEvidencePurged(Clock.Now);
        await _releases.UpdateAsync(request);
        await _audit.RecordAsync(new AuditEntry(AuditActions.EvidencePurged, request.OwnerId,
            TargetType: nameof(ReleaseRequest), TargetId: request.Id.ToString(), Detail: "Tự động xoá theo chính sách lưu trữ"));
    }

    private string CheckInLink(OwnerProfile owner) =>
        $"{_urls.AppUrl}/check-in?token={Uri.EscapeDataString(_links.CreateToken(owner))}";
}
