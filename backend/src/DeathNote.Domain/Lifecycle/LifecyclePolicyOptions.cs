namespace DeathNote.Lifecycle;

/// <summary>
/// Tham số chính sách vòng đời. Giá trị khởi đầu đọc từ appsettings → "DeathNote:Policy";
/// các tham số nghiệp vụ admin chỉnh trên console được lưu trong CSDL và ghi đè lên (xem <see cref="LifecyclePolicyStore"/>).
/// </summary>
public class LifecyclePolicyOptions
{
    /// <summary>Độ dài giai đoạn Missed (ngày) — khoảng thời gian leo thang các kênh nhắc.</summary>
    public int MissedPhaseDays { get; set; } = 7;

    /// <summary>
    /// Thứ tự kênh nhắc khi owner quá hạn check-in. Mỗi kênh là 1 "vòng nhắc",
    /// chia đều trong <see cref="MissedPhaseDays"/>. Hết các vòng mà không phản hồi → Grace.
    /// </summary>
    public string[] ReminderChannels { get; set; } = [.. AvailableReminderChannels];

    /// <summary>Các kênh nhắc hệ thống hỗ trợ.</summary>
    public static readonly string[] AvailableReminderChannels = ["push", "email", "sms", "call"];

    /// <summary>Thời gian ân hạn mặc định (ngày) nếu owner không chọn. Owner được chọn 7–30.</summary>
    public int DefaultGraceDays { get; set; } = 14;
    public int MinGraceDays { get; set; } = 7;
    public int MaxGraceDays { get; set; } = 30;

    /// <summary>Chế độ tạm dừng (du lịch/nhập viện) tối đa bao nhiêu ngày — không cho phép vô thời hạn.</summary>
    public int MaxPauseDays { get; set; } = 60;

    /// <summary>
    /// Hệ số nén thời gian DÀNH CHO DEMO. 1 = thời gian thật.
    /// Ví dụ 2880 → 1 ngày chỉ còn 30 giây, giúp trình diễn trọn vòng đời trong vài phút.
    /// </summary>
    public double TimeScale { get; set; } = 1;

    /// <summary>Chu kỳ chạy của background worker (giây).</summary>
    public int WorkerPeriodSeconds { get; set; } = 60;
}
