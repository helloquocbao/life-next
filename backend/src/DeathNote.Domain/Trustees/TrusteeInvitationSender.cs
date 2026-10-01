using DeathNote.Infrastructure;
using DeathNote.Notifications;
using DeathNote.Owners;
using Microsoft.Extensions.Options;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Domain.Services;

namespace DeathNote.Trustees;

/// <summary>
/// Sinh token + gửi email/SMS lời mời cho một trustee — dùng chung cho hai nơi gọi đến:
/// owner chủ động bấm "Gửi lời mời ngay" (<see cref="DeathNote.Trustees.ITrusteeAppService"/>),
/// hoặc hệ thống tự động gửi khi owner bị Missed (<see cref="DeathNote.Lifecycle.LifecycleManager"/>).
/// </summary>
public class TrusteeInvitationSender : DomainService
{
    private readonly IRepository<Trustee, Guid> _trustees;
    private readonly INotificationSender _notifier;
    private readonly NotificationTemplates _templates;
    private readonly DeathNoteAppUrlOptions _urls;

    public TrusteeInvitationSender(IRepository<Trustee, Guid> trustees, INotificationSender notifier, IOptions<DeathNoteAppUrlOptions> urls, NotificationTemplates templates)
    {
        _trustees = trustees;
        _notifier = notifier;
        _templates = templates;
        _urls = urls.Value;
    }

    public async Task SendAsync(OwnerProfile owner, Trustee trustee, DateTime now)
    {
        var token = trustee.IssueInvitationToken(now);
        await _trustees.UpdateAsync(trustee);

        var roleName = trustee.Role switch
        {
            TrusteeRole.KeyHolder => "người giữ mảnh khoá",
            TrusteeRole.Verifier => "người xác nhận",
            _ => "người nhận nội dung"
        };
        var link = $"{_urls.AppUrl}/invite?token={Uri.EscapeDataString(token)}";
        var (subject, body) = await _templates.TrusteeInvitationAsync(trustee.DisplayName, owner.DisplayName, roleName, link);
        await _notifier.SendAsync(new NotificationMessage(trustee.DisplayName, trustee.Email, trustee.PhoneNumber, subject, body,
            NotificationChannels.Email | NotificationChannels.Sms));
    }
}
