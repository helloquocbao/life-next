namespace DeathNote.Lifecycle;

/// <summary>
/// Kênh owner dùng để xác nhận "tôi vẫn ổn". Nguyên tắc: không mở app ≠ không phản hồi —
/// owner có thể check-in bằng link trong email/SMS mà không cần mở app.
/// </summary>
public enum CheckInChannel
{
    MobileApp = 0,
    Web = 1,
    EmailLink = 2,
    SmsLink = 3
}
