using DeathNote.AuditTrail;
using DeathNote.Infrastructure;
using DeathNote.Notifications;
using DeathNote.Owners;
using DeathNote.Trustees;
using DeathNote.Vaults;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Domain.Services;

namespace DeathNote.Lifecycle;

/// <summary>
/// Domain service điều phối vòng đời hồ sơ: check-in (kèm quyền phủ quyết), leo thang nhắc owner,
/// chuyển Missed → Grace (báo người nhắc nhở), hết ân hạn thì TỰ ĐỘNG bàn giao cho người nhận.
/// Được gọi bởi app service (hành động của owner) và bởi <see cref="LifecycleWorker"/> (theo thời gian).
/// </summary>
public class LifecycleManager : DomainService
{
    private readonly IRepository<OwnerProfile, Guid> _owners;
    private readonly IRepository<Heartbeat, Guid> _heartbeats;
    private readonly IRepository<Trustee, Guid> _trustees;
    private readonly IRepository<Grant, Guid> _grants;
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
        IRepository<Grant, Guid> grants,
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
        _grants = grants;
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
        await _audit.RecordAsync(new AuditEntry(AuditActions.OwnerVeto, owner.Id, ActorType: AuditActorType.Owner,
            ActorUserId: owner.Id, ActorName: owner.DisplayName, Detail: $"Huỷ tiến trình từ trạng thái {previous}"));

        // Chỉ báo những người nhắc nhở đã từng được thông báo (từ Grace trở đi). Người nhận thông tin
        // chưa bao giờ biết chuyện gì xảy ra nên không có gì để "huỷ".
        if (previous >= LifecycleState.Grace)
        {
            foreach (var t in await _trustees.GetListAsync(t =>
                         t.OwnerId == owner.Id && t.Role == TrusteeRole.Reminder && t.Status != TrusteeStatus.NotInvitedYet))
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
            // mới tự động mời những người nhắc nhở owner đã thêm nhưng chưa từng tiết lộ (NotInvitedYet).
            await InviteNotYetInvitedRemindersAsync(owner, now);
        }

        // Missed: leo thang từng vòng nhắc
        if (owner.GetDueReminderStep(now, _policy) is { } step)
        {
            await SendReminderAsync(owner, step, now);
        }

        // Missed → Grace: báo cho người nhắc nhở "hãy liên lạc với owner, nhắc họ bấm Tôi vẫn ổn"
        if (owner.ShouldEnterGrace(now, _policy))
        {
            owner.EnterGrace(now);
            await RecordStateChangeAsync(owner, LifecycleState.Missed);
            await NotifyRemindersAsync(owner, now);
        }

        // Grace → Released: hết ân hạn mà owner vẫn im lặng → tự động bàn giao cho người nhận
        if (owner.ShouldReleaseAutomatically(now, _policy))
        {
            await ReleaseToRecipientsAsync(owner, now);
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

    /// <summary>
    /// Lúc owner thật sự bỏ lỡ xác nhận, tự gửi lời mời cho những NGƯỜI NHẮC NHỞ owner đã thêm nhưng chưa
    /// từng tiết lộ (NotInvitedYet) — họ không cần khoá nên mời lúc này vẫn kịp. Người nhận thông tin thì
    /// KHÔNG: phần dành cho họ phải được niêm phong bằng khoá công khai của họ từ trước, owner chủ động mời.
    /// </summary>
    private async Task InviteNotYetInvitedRemindersAsync(OwnerProfile owner, DateTime now)
    {
        foreach (var t in await _trustees.GetListAsync(t =>
                     t.OwnerId == owner.Id && t.Status == TrusteeStatus.NotInvitedYet && t.Role == TrusteeRole.Reminder))
        {
            await _invitationSender.SendAsync(owner, t, now);
            await _audit.RecordAsync(new AuditEntry(AuditActions.TrusteeInvited, owner.Id, t.Id,
                Detail: $"{t.DisplayName} — {t.Role} (tự động gửi khi owner bỏ lỡ xác nhận)"));
        }
    }

    /// <summary>Báo người nhắc nhở: owner im lặng, còn đúng chừng này ngày trước khi thông tin được gửi đi.</summary>
    private async Task NotifyRemindersAsync(OwnerProfile owner, DateTime now)
    {
        var silentDays = owner.LastCheckInAt.HasValue
            ? (int)Math.Round((now - owner.LastCheckInAt.Value).TotalDays * _policy.Options.TimeScale)
            : 0;
        var reminders = await _trustees.GetListAsync(t =>
            t.OwnerId == owner.Id && t.Role == TrusteeRole.Reminder && t.Status != TrusteeStatus.NotInvitedYet);
        foreach (var t in reminders)
        {
            var (subject, body) = await _templates.TrusteeGraceAlertAsync(t.DisplayName, owner.DisplayName, silentDays, owner.GraceDays, _urls.AppUrl);
            await _notifier.SendAsync(new NotificationMessage(t.DisplayName, t.Email, t.PhoneNumber, subject, body,
                NotificationChannels.Email | NotificationChannels.Sms));
        }
        await _audit.RecordAsync(new AuditEntry(AuditActions.RemindersNotified, owner.Id,
            Detail: $"Đã báo {reminders.Count} người nhắc nhở — còn {owner.GraceDays} ngày trước khi bàn giao"));
    }

    /// <summary>
    /// Hết ân hạn: chuyển hồ sơ sang Released. Từ lúc này server mới trao phần đã niêm phong (Grant) cho từng
    /// người nhận — mỗi người tự mở bằng khoá cá nhân trên thiết bị của họ. Chỉ báo những người nhận THỰC SỰ
    /// có phần để mở (được owner phân hạng mục/thư), tránh gửi thông báo rỗng. Người nhận mặc định không biết gì từ trước.
    /// </summary>
    private async Task ReleaseToRecipientsAsync(OwnerProfile owner, DateTime now)
    {
        owner.ReleaseAutomatically(now);
        await RecordStateChangeAsync(owner, LifecycleState.Grace);

        var grants = await _grants.GetListAsync(g => g.OwnerId == owner.Id);
        var recipients = (await _trustees.GetListAsync(t => t.OwnerId == owner.Id && t.Role == TrusteeRole.Recipient))
            .Where(t => grants.Any(g => g.TrusteeId == t.Id))
            .ToList();

        await _audit.RecordAsync(new AuditEntry(AuditActions.AutoReleased, owner.Id,
            Detail: $"Hết {owner.GraceDays} ngày ân hạn mà owner không xác nhận — tự động bàn giao cho {recipients.Count} người nhận"));

        // Người nhận chưa từng biết gì: email này (kèm link nhận) là lần đầu họ được báo.
        foreach (var t in recipients) await _invitationSender.SendDeliveryAsync(owner, t, now);
    }

    private Task RecordStateChangeAsync(OwnerProfile owner, LifecycleState from)
    {
        Logger.LogInformation("Owner {OwnerId}: {From} → {To}", owner.Id, from, owner.State);
        return _audit.RecordAsync(new AuditEntry(AuditActions.StateChanged, owner.Id, Detail: $"{from} → {owner.State}"));
    }
}
