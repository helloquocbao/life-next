using Microsoft.Extensions.Logging;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Emailing;

namespace DeathNote.Notifications;

/// <summary>
/// Implementation mặc định cho MVP:
/// <list type="bullet">
/// <item>Email: gửi thật qua Resend khi cấu hình <c>Resend:ApiKey</c>, ngược lại qua SMTP (dev dùng Mailpit — xem http://localhost:8026).</item>
/// <item>SMS / Push / Gọi tự động: ghi log có tiền tố [STUB] — Phase tiếp theo tích hợp eSMS/SpeedSMS, Web Push, tổng đài.</item>
/// </list>
/// Lỗi gửi thông báo KHÔNG được làm hỏng nghiệp vụ chính (vd. chuyển trạng thái), nên chỉ ghi log cảnh báo.
/// </summary>
public class DefaultNotificationSender : INotificationSender, ITransientDependency
{
    private readonly IEmailSender _emailSender;
    private readonly EmailTemplateRenderer _templates;
    private readonly ILogger<DefaultNotificationSender> _logger;

    public DefaultNotificationSender(IEmailSender emailSender, EmailTemplateRenderer templates, ILogger<DefaultNotificationSender> logger)
    {
        _emailSender = emailSender;
        _templates = templates;
        _logger = logger;
    }

    public async Task SendAsync(NotificationMessage m)
    {
        if (m.Channels.HasFlag(NotificationChannels.Email) && !string.IsNullOrWhiteSpace(m.Email))
        {
            try
            {
                var html = await _templates.WrapInLayoutAsync(m.Subject, m.HtmlBody);
                await _emailSender.SendAsync(m.Email, m.Subject, html, isBodyHtml: true);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Không gửi được email tới {Email}", m.Email);
            }
        }
        if (m.Channels.HasFlag(NotificationChannels.Sms))
            _logger.LogInformation("[STUB][SMS] → {Phone}: {Subject}", m.PhoneNumber ?? "(chưa có số)", m.Subject);
        if (m.Channels.HasFlag(NotificationChannels.Push))
            _logger.LogInformation("[STUB][PUSH] → {Name}: {Subject}", m.RecipientName, m.Subject);
        if (m.Channels.HasFlag(NotificationChannels.Call))
            _logger.LogInformation("[STUB][CALL] → {Phone}: {Subject}", m.PhoneNumber ?? "(chưa có số)", m.Subject);
    }
}
