namespace DeathNote.Lifecycle;

/// <summary>
/// Tham số chính sách vòng đời (cấu hình tại appsettings → "DeathNote:Policy").
/// Giá trị mặc định bám theo cột "Thời lượng gợi ý" trong tài liệu thiết kế.
/// </summary>
public class LifecyclePolicyOptions
{
    /// <summary>Độ dài giai đoạn Missed (ngày) — khoảng thời gian leo thang các kênh nhắc.</summary>
    public int MissedPhaseDays { get; set; } = 7;

    /// <summary>
    /// Thứ tự kênh nhắc khi owner quá hạn check-in. Mỗi kênh là 1 "vòng nhắc",
    /// chia đều trong <see cref="MissedPhaseDays"/>. Hết các vòng mà không phản hồi → Grace.
    /// </summary>
    public string[] ReminderChannels { get; set; } = ["push", "email", "sms", "call"];

    /// <summary>Thời gian ân hạn mặc định (ngày) nếu owner không chọn. Owner được chọn 7–30.</summary>
    public int DefaultGraceDays { get; set; } = 14;
    public int MinGraceDays { get; set; } = 7;
    public int MaxGraceDays { get; set; } = 30;

    /// <summary>Thời gian chờ cuối sau khi admin duyệt (giờ) — owner còn cơ hội phủ quyết.</summary>
    public int FinalWaitHours { get; set; } = 72;

    /// <summary>SLA thẩm định của đội vận hành (ngày làm việc) — dùng để cảnh báo quá hạn trên dashboard.</summary>
    public int ReviewSlaDays { get; set; } = 3;

    /// <summary>Chế độ tạm dừng (du lịch/nhập viện) tối đa bao nhiêu ngày — không cho phép vô thời hạn.</summary>
    public int MaxPauseDays { get; set; } = 60;

    /// <summary>Trustee mới được thêm trong khoảng này trước khi có yêu cầu mở sẽ bị gắn cờ rủi ro.</summary>
    public int NewTrusteeRiskDays { get; set; } = 7;

    /// <summary>Số ngày giữ giấy tờ xác minh sau khi đóng hồ sơ, sau đó tự động xoá.</summary>
    public int EvidenceRetentionDays { get; set; } = 30;

    /// <summary>
    /// Nếu bật: các đồng thuận đến từ cùng một địa chỉ IP chỉ được tính là MỘT phiếu
    /// (chống một người giả danh nhiều trustee). Tắt trong môi trường demo cục bộ.
    /// </summary>
    public bool EnforceDistinctConsentIp { get; set; } = true;

    /// <summary>
    /// Hệ số nén thời gian DÀNH CHO DEMO. 1 = thời gian thật.
    /// Ví dụ 2880 → 1 ngày chỉ còn 30 giây, giúp trình diễn trọn vòng đời trong vài phút.
    /// </summary>
    public double TimeScale { get; set; } = 1;

    /// <summary>Chu kỳ chạy của background worker (giây).</summary>
    public int WorkerPeriodSeconds { get; set; } = 60;
}
