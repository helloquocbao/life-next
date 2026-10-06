namespace DeathNote.Notifications;

/// <summary>
/// Khoá định danh các mẫu email. Là chuỗi ổn định (lưu trong CSDL + dùng làm route admin),
/// KHÔNG đổi tên sau khi đã phát hành — đổi tên sẽ làm mất bản tuỳ chỉnh đã lưu.
/// </summary>
public static class EmailTemplateKeys
{
    /// <summary>Khung chung bọc mọi email (tiêu đề, chân thư). Biến <c>{{content}}</c> là nội dung từng thư.</summary>
    public const string Layout = "layout";

    public const string CheckInReminderFirst = "check-in-reminder-first";
    public const string CheckInReminderRepeat = "check-in-reminder-repeat";
    public const string CheckInReminderFinal = "check-in-reminder-final";
    public const string TrusteeInvitation = "trustee-invitation";
    public const string TrusteeGraceAlert = "trustee-grace-alert";
    public const string TrusteeCancelled = "trustee-cancelled";
    public const string TrusteeReleased = "trustee-released";

    public const int MaxKeyLength = 64;
    public const int MaxSubjectLength = 256;
    public const int MaxBodyLength = 64 * 1024;
}
