using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Mail;
using DeathNote.Notifications;
using Microsoft.Extensions.Options;
using Volo.Abp.BackgroundJobs;
using Volo.Abp.Emailing;
using Volo.Abp.MultiTenancy;

namespace DeathNote.Infrastructure;

/// <summary>
/// Gửi email qua Resend HTTP API (<c>POST https://api.resend.com/emails</c>) thay cho SMTP.
/// Chỉ được đăng ký khi có <c>Resend:ApiKey</c> (xem <see cref="DeathNoteHttpApiHostModule"/>).
/// Lỗi từ Resend (domain chưa verify, key sai…) được ném ra kèm nội dung phản hồi để dễ chẩn đoán.
/// </summary>
public class ResendEmailSender : EmailSenderBase
{
    public const string HttpClientName = "Resend";

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ResendOptions _options;

    public ResendEmailSender(ICurrentTenant currentTenant, IEmailSenderConfiguration configuration,
        IBackgroundJobManager backgroundJobManager, IHttpClientFactory httpClientFactory, IOptions<ResendOptions> options)
        : base(currentTenant, configuration, backgroundJobManager)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
    }

    // Người gửi luôn lấy từ cấu hình Resend: địa chỉ mặc định của ABP (no-reply@deathnote.local) không thuộc domain đã verify.
    protected override Task NormalizeMailAsync(MailMessage mail) => Task.CompletedTask;

    protected override async Task SendEmailAsync(MailMessage mail)
    {
        var payload = new Dictionary<string, object?>
        {
            ["from"] = _options.FromAddress,
            ["to"] = mail.To.Select(a => a.Address).ToArray(),
            ["subject"] = mail.Subject,
            [mail.IsBodyHtml ? "html" : "text"] = mail.Body
        };
        if (mail.CC.Count > 0) payload["cc"] = mail.CC.Select(a => a.Address).ToArray();
        if (mail.Bcc.Count > 0) payload["bcc"] = mail.Bcc.Select(a => a.Address).ToArray();
        if (mail.ReplyToList.Count > 0) payload["reply_to"] = mail.ReplyToList.Select(a => a.Address).ToArray();

        using var request = new HttpRequestMessage(HttpMethod.Post, "emails") { Content = JsonContent.Create(payload) };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);

        var client = _httpClientFactory.CreateClient(HttpClientName);
        using var response = await client.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            var detail = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"Resend trả về {(int)response.StatusCode}: {detail}");
        }

        var result = await response.Content.ReadFromJsonAsync<ResendSendResult>();
        Logger.LogInformation("Đã gửi email qua Resend tới {To} (id {Id})", string.Join(", ", mail.To.Select(a => a.Address)), result?.Id);
    }

    private sealed record ResendSendResult(string? Id);
}
