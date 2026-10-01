using DeathNote.AuditTrail;
using DeathNote.Infrastructure;
using DeathNote.Notifications;
using DeathNote.Owners;
using DeathNote.Releases;
using DeathNote.Trustees;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Domain.Services;

namespace DeathNote.Lifecycle;

/// <summary>
/// Domain service điều phối vòng đời hồ sơ: check-in (kèm quyền phủ quyết), leo thang nhắc nhở,
/// chuyển Missed → Grace và báo cho người thân. Được gọi bởi app service (hành động của owner)
/// và bởi <see cref="LifecycleWorker"/> (theo thời gian).
/// </summary>
public class LifecycleManager : DomainService
{
    private readonly IRepository<OwnerProfile, Guid> _owners;
    private readonly IRepository<Heartbeat, Guid> _heartbeats;
    private readonly IRepository<Trustee, Guid> _trustees;
    private readonly IRepository<ReleaseRequest, Guid> _releases;
    private readonly LifecyclePolicy _policy;
    private readonly AuditTrailManager _audit;
    private readonly INotificationSender _notifier;
    private readonly NotificationTemplates _templates;
    private readonly CheckInLinkService _links;
    private readonly IRequestContext _request;
    private readonly DeathNoteAppUrlOptions _urls;
    private readonly TrusteeInvitationSender _invitationSender;

    public LifecycleManager(
        IRepository<OwnerProfile, Guid> owners,
        IRepository<Heartbeat, Guid> heartbeats,
        IRepository<Trustee, Guid> trustees,
        IRepository<ReleaseRequest, Guid> releases,
        LifecyclePolicy policy,
        AuditTrailManager audit,
        INotificationSender notifier,
        CheckInLinkService links,
        IRequestContext request,
        IOptions<DeathNoteAppUrlOptions> urls,
        TrusteeInvitationSender invitationSender,
        NotificationTemplates templates)
    {
        _owners = owners;
        _heartbeats = heartbeats;
        _trustees = trustees;
        _releases = releases;
        _policy = policy;
        _audit = audit;
        _notifier = notifier;
        _templates = templates;
        _links = links;
        _request = request;
        _urls = urls.Value;
        _invitationSender = invitationSender;
    }

    // =====================================================================
    //  CHECK-IN + QUYỀN PHỦ QUYẾT
    // =====================================================================

    /// <summary>
    /// Owner xác nhận "tôi vẫn ổn". Nếu đang có tiến trình cảnh báo/xác minh → huỷ toàn bộ,
    /// đóng yêu cầu mở đang chạy và báo cho mọi trustee.
    /// </summary>
    public async Task<LifecycleState> CheckInAsync(OwnerProfile owner, CheckInChannel channel)
    {
        var now = Clock.Now;
        var previous = owner.CheckIn(now, _policy);
        var isVeto = previous != LifecycleState.Active;

        await _heartbeats.InsertAsync(new Heartbeat(GuidGenerator.Create(), owner.Id, now, channel,
            _request.IpAddress, _request.UserAgent, isVeto));
        await _owners.UpdateAsync(owner);

        await _audit.RecordAsync(new AuditEntry(AuditActions.CheckIn, owner.Id, ActorType: AuditActorType.Owner,
            ActorUserId: owner.Id, ActorName: owner.DisplayName, Detail: $"Kênh: {channel}"));

        if (isVeto)
        {
            await HandleVetoAsync(owner, previous, now);
        }
        return previous;
    }

    private async Task HandleVetoAsync(OwnerProfile owner, LifecycleState previous, DateTime now)
    {
        var open = await _releases.FirstOrDefaultAsync(r => r.OwnerId == owner.Id &&
            r.Status != ReleaseStatus.Released && r.Status != ReleaseStatus.Rejected && r.Status != ReleaseStatus.CancelledByOwner);
        if (open != null)
        {
            open.CancelByOwner(now);
            await _releases.UpdateAsync(open);
            await _audit.RecordAsync(new AuditEntry(AuditActions.ReleaseCancelled, owner.Id, ActorType: AuditActorType.Owner,
                ActorUserId: owner.Id, ActorName: owner.DisplayName, TargetType: nameof(ReleaseRequest), TargetId: open.Id.ToString()));
        }

        await _audit.RecordAsync(new AuditEntry(AuditActions.OwnerVeto, owner.Id, ActorType: AuditActorType.Owner,
            ActorUserId: owner.Id, ActorName: owner.DisplayName, Detail: $"Huỷ tiến trình từ trạng thái {previous}"));

        // Chỉ báo cho trustee nếu họ đã từng được thông báo (từ Grace trở đi).
        if (previous >= LifecycleState.Grace)
        {
            foreach (var t in await _trustees.GetListAsync(t => t.OwnerId == owner.Id && t.Status == TrusteeStatus.Confirmed))
            {
                var (subject, body) = await _templates.TrusteeCancelledAsync(t.DisplayName, owner.DisplayName);
                await _notifier.SendAsync(new NotificationMessage(t.DisplayName, t.Email, t.PhoneNumber, subject, body,
                    NotificationChannels.Email | NotificationChannels.Push));
            }
        }
    }

    // =====================================================================
    //  XỬ LÝ THEO THỜI GIAN (gọi bởi worker)
    // =====================================================================

    /// <summary>Đánh giá một hồ sơ tại thời điểm hiện tại và thực hiện các bước chuyển đến hạn.</summary>
    public async Task ProcessOwnerAsync(OwnerProfile owner)
    {
        var now = Clock.Now;

        if (owner.PausedUntil.HasValue && owner.PausedUntil <= now)
        {
            owner.Resume();
            await _audit.RecordAsync(new AuditEntry(AuditActions.Resumed, owner.Id, Detail: "Chế độ tạm dừng tự hết hạn"));
        }

        // Active → Missed
        if (owner.IsCheckInOverdue(now))
        {
            owner.MarkMissed(now);
            await RecordStateChangeAsync(owner, LifecycleState.Active);
            // Owner không muốn người thân biết trước — chỉ đến đây, lúc thật sự bỏ lỡ xác nhận, hệ thống
            // mới tự động gửi lời mời cho những người owner đã thêm nhưng chưa từng tiết lộ (NotInvitedYet).
            await InviteNotYetInvitedTrusteesAsync(owner, now);
        }

        // Missed: leo thang từng vòng nhắc
        if (owner.GetDueReminderStep(now, _policy) is { } step)
        {
            await SendReminderAsync(owner, step, now);
        }

        // Missed → Grace: báo cho người thân mức "hãy liên lạc"
        if (owner.ShouldEnterGrace(now, _policy))
        {
            owner.EnterGrace(now);
            await RecordStateChangeAsync(owner, LifecycleState.Missed);
            await NotifyTrusteesGraceAsync(owner, now);
        }

        await _owners.UpdateAsync(owner);
    }

    private async Task SendReminderAsync(OwnerProfile owner, int step, DateTime now)
    {
        owner.RegisterReminderSent(now);
        var channelName = _policy.Options.ReminderChannels.ElementAtOrDefault(step) ?? "email";
        var link = $"{_urls.AppUrl}/check-in?token={Uri.EscapeDataString(_links.CreateToken(owner))}";
        var (subject, body) = await _templates.CheckInReminderAsync(owner.DisplayName, step, _policy.ReminderSteps, link);

        // Mỗi vòng luôn gửi kèm email (để owner luôn có link 1 chạm), cộng thêm kênh của vòng đó.
        var channels = NotificationChannels.Email | channelName switch
        {
            "sms" => NotificationChannels.Sms,
            "push" => NotificationChannels.Push,
            "call" => NotificationChannels.Call,
            _ => NotificationChannels.None
        };
        await _notifier.SendAsync(new NotificationMessage(owner.DisplayName, owner.Email, owner.PhoneNumber, subject, body, channels));
        await _audit.RecordAsync(new AuditEntry(AuditActions.ReminderSent, owner.Id,
            Detail: $"Vòng {step + 1}/{_policy.ReminderSteps} — kênh {channelName}"));
    }

    private async Task InviteNotYetInvitedTrusteesAsync(OwnerProfile owner, DateTime now)
    {
        foreach (var t in await _trustees.GetListAsync(t => t.OwnerId == owner.Id && t.Status == TrusteeStatus.NotInvitedYet))
        {
            await _invitationSender.SendAsync(owner, t, now);
            await _audit.RecordAsync(new AuditEntry(AuditActions.TrusteeInvited, owner.Id, t.Id,
                Detail: $"{t.DisplayName} — {t.Role} (tự động gửi khi owner bỏ lỡ xác nhận)"));
        }
    }

    private async Task NotifyTrusteesGraceAsync(OwnerProfile owner, DateTime now)
    {
        var silentDays = owner.LastCheckInAt.HasValue
            ? (int)Math.Round((now - owner.LastCheckInAt.Value).TotalDays * _policy.Options.TimeScale)
            : 0;
        foreach (var t in await _trustees.GetListAsync(t => t.OwnerId == owner.Id && t.Status == TrusteeStatus.Confirmed))
        {
            var (subject, body) = await _templates.TrusteeGraceAlertAsync(t.DisplayName, owner.DisplayName, silentDays, _urls.AppUrl);
            await _notifier.SendAsync(new NotificationMessage(t.DisplayName, t.Email, t.PhoneNumber, subject, body,
                NotificationChannels.Email | NotificationChannels.Sms));
        }
    }

    private Task RecordStateChangeAsync(OwnerProfile owner, LifecycleState from)
    {
        Logger.LogInformation("Owner {OwnerId}: {From} → {To}", owner.Id, from, owner.State);
        return _audit.RecordAsync(new AuditEntry(AuditActions.StateChanged, owner.Id, Detail: $"{from} → {owner.State}"));
    }
}
