namespace DeathNote.Notifications;

/// <summary>
/// Cấu hình gửi email qua Resend (https://resend.com) — mục "Resend" trong appsettings / biến môi trường
/// <c>Resend__ApiKey</c>. Để trống <see cref="ApiKey"/> thì hệ thống gửi qua SMTP (dev: Mailpit).
/// <para>API key là bí mật: dev đặt bằng <c>dotnet user-secrets</c>, production qua biến môi trường — không commit.</para>
/// </summary>
public class ResendOptions
{
    public string? ApiKey { get; set; }

    /// <summary>
    /// Người gửi, dạng <c>Tên &lt;email@domain&gt;</c>. Domain phải được verify trên Resend;
    /// địa chỉ thử nghiệm <c>onboarding@resend.dev</c> chỉ gửi được tới email chủ tài khoản Resend.
    /// </summary>
    public string FromAddress { get; set; } = "Death Note <onboarding@resend.dev>";

    public bool IsEnabled => !string.IsNullOrWhiteSpace(ApiKey);
}
