namespace DeathNote.Notifications;

/// <summary>Kênh gửi thông báo. MVP gửi thật qua Email; SMS/Push/Gọi tự động được ghi log (stub) chờ tích hợp nhà cung cấp.</summary>
[Flags]
public enum NotificationChannels
{
    None = 0,
    Email = 1,
    Sms = 2,
    Push = 4,
    Call = 8,
    All = Email | Sms | Push | Call
}

public record NotificationMessage(
    string RecipientName,
    string? Email,
    string? PhoneNumber,
    string Subject,
    string HtmlBody,
    NotificationChannels Channels = NotificationChannels.Email);
