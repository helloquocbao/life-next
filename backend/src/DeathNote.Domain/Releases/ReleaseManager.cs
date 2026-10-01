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
/// Domain service điều phối quy trình mở vault: khởi tạo → đồng thuận → thẩm định → chờ cuối → phát hành.
/// Mỗi bước đồng bộ trạng thái giữa <see cref="ReleaseRequest"/> và <see cref="OwnerProfile"/>,
/// ghi audit và gửi thông báo tới đúng người.
/// </summary>
public class ReleaseManager : DomainService
{
    private readonly IRepository<ReleaseRequest, Guid> _releases;
    private readonly IRepository<OwnerProfile, Guid> _owners;
    private readonly IRepository<Trustee, Guid> _trustees;
    private readonly IRepository<Vault, Guid> _vaults;
    private readonly IRepository<KeyShare, Guid> _keyShares;
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
        IRepository<KeyShare, Guid> keyShares,
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
        _keyShares = keyShares;
        _evidenceBlobs = evidenceBlobs;
        _policy = policy;
        _audit = audit;
        _notifier = notifier;
        _templates = templates;
        _links = links;
        _request = request;
        _urls = urls.Value;
    }

    /// <summary>
    /// Trustee khởi tạo yêu cầu mở. Chỉ được phép khi owner đang Grace và đã hết thời gian ân hạn
    /// (cổng thời gian), owner đã phân mảnh khoá, và chưa có yêu cầu nào đang chạy.
    /// </summary>
    public async Task<ReleaseRequest> InitiateAsync(OwnerProfile owner, Trustee initiator, ReleaseReason reason, string? statement)
    {
        var now = Clock.Now;
        if (initiator.Role == TrusteeRole.ContentOnly || initiator.Status != TrusteeStatus.Confirmed)
            throw new BusinessException(DeathNoteErrorCodes.NotATrustee);
        if (!owner.CanAcceptReleaseRequest(now, _policy))
            throw new BusinessException(DeathNoteErrorCodes.ReleaseNotAllowedInState);
        if (await _releases.AnyAsync(r => r.OwnerId == owner.Id && r.Status != ReleaseStatus.Released
                                          && r.Status != ReleaseStatus.Rejected && r.Status != ReleaseStatus.CancelledByOwner))
            throw new BusinessException(DeathNoteErrorCodes.ReleaseAlreadyOpen);

        var vault = await _vaults.FindAsync(owner.Id);
        if (vault is not { HasKeyDistribution: true }) throw new BusinessException(DeathNoteErrorCodes.VaultNotInitialized);

        var request = new ReleaseRequest(GuidGenerator.Create(), owner.Id, initiator.Id, reason, statement,
            vault.Threshold!.Value, vault.KeyVersion, now);
        await _releases.InsertAsync(request, autoSave: true);

        owner.EnterVerifying(now);
        await _owners.UpdateAsync(owner);

        await _audit.RecordAsync(new AuditEntry(AuditActions.ReleaseInitiated, owner.Id, initiator.Id, AuditActorType.Trustee,
            initiator.UserId, initiator.DisplayName, nameof(ReleaseRequest), request.Id.ToString(), $"Lý do: {reason}"));

        // Owner: cảnh báo qua MỌI kênh — nếu còn ổn, 1 chạm là huỷ.
        var link = CheckInLink(owner);
        var (s1, b1) = await _templates.OwnerReleaseInitiatedAsync(owner.DisplayName, link);
        await _notifier.SendAsync(new NotificationMessage(owner.DisplayName, owner.Email, owner.PhoneNumber, s1, b1, NotificationChannels.All));

        // Các trustee khác: mời xác nhận.
        foreach (var t in await _trustees.GetListAsync(t => t.OwnerId == owner.Id && t.Id != initiator.Id && t.Status == TrusteeStatus.Confirmed))
        {
            var (s2, b2) = await _templates.TrusteeRequestOpenedAsync(t.DisplayName, owner.DisplayName, _urls.AppUrl);
            await _notifier.SendAsync(new NotificationMessage(t.DisplayName, t.Email, t.PhoneNumber, s2, b2,
                NotificationChannels.Email | NotificationChannels.Sms));
        }
        return request;
    }

    /// <summary>
    /// Người giữ khoá đồng thuận. Bắt buộc gửi kèm mảnh khoá của mình đã niêm phong lại cho
    /// TỪNG trustee nhận khác (đầy đủ, không thiếu không thừa) — nếu không, cổng mật mã không qua.
    /// </summary>
    public async Task ConsentAsync(ReleaseRequest request, Trustee trustee, string? statement,
        IReadOnlyCollection<(Guid ToTrusteeId, string SealedShare)> deliveries)
    {
        var now = Clock.Now;
        if (trustee.Role != TrusteeRole.KeyHolder) throw new BusinessException(DeathNoteErrorCodes.OnlyKeyHoldersCanConsent);
        if (!await _keyShares.AnyAsync(k => k.TrusteeId == trustee.Id && k.KeyVersion == request.KeyVersion))
            throw new BusinessException(DeathNoteErrorCodes.OnlyKeyHoldersCanConsent);

        var recipients = (await _trustees.GetListAsync(t => t.OwnerId == request.OwnerId && t.Id != trustee.Id))
            .Where(t => t.IsReadyForKeys).Select(t => t.Id).ToHashSet();
        var delivered = deliveries.Select(d => d.ToTrusteeId).ToList();
        if (delivered.Count != recipients.Count || !recipients.SetEquals(delivered) ||
            deliveries.Any(d => string.IsNullOrWhiteSpace(d.SealedShare)))
            throw new BusinessException(DeathNoteErrorCodes.InvalidShareDeliveries);

        var reached = request.AddConsent(GuidGenerator.Create(), trustee.Id, _request.IpAddress, _request.UserAgent,
            statement, deliveries, now, _policy.Options.EnforceDistinctConsentIp);
        await _releases.UpdateAsync(request);

        await _audit.RecordAsync(new AuditEntry(AuditActions.ReleaseConsented, request.OwnerId, trustee.Id, AuditActorType.Trustee,
            trustee.UserId, trustee.DisplayName, nameof(ReleaseRequest), request.Id.ToString(),
            $"Đồng thuận {request.EffectiveConsentCount(_policy.Options.EnforceDistinctConsentIp)}/{request.RequiredConsents}"));

        if (reached)
        {
            var owner = await _owners.GetAsync(request.OwnerId);
            owner.EnterReview(now);
            await _owners.UpdateAsync(owner);
            await _audit.RecordAsync(new AuditEntry(AuditActions.StateChanged, owner.Id, Detail: "Verifying → Review (đủ ngưỡng m-of-n)"));
        }
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
                foreach (var t in trustees.Where(t => t.Role != TrusteeRole.ContentOnly))
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

        foreach (var t in await _trustees.GetListAsync(t => t.OwnerId == owner.Id && t.Status == TrusteeStatus.Confirmed))
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
