namespace DeathNote.Trustees;

/// <summary>
/// Vai trò của một người trong hồ sơ của owner. Luồng bàn giao là TỰ ĐỘNG theo thời gian (không còn đồng thuận
/// m-of-n hay thẩm định): owner im lặng → nhắc owner → báo <see cref="Reminder"/> → hết ân hạn → gửi cho
/// <see cref="Recipient"/>.
/// </summary>
public enum TrusteeRole
{
    // Giá trị 0 (KeyHolder — người giữ mảnh khoá) đã bị bỏ cùng cơ chế m-of-n; dữ liệu cũ được đổi
    // sang Recipient bằng migration. Giữ nguyên số của hai vai trò còn lại để không phải đổi dữ liệu.

    /// <summary>
    /// Người nhận thông tin: sau khi hết thời gian ân hạn mà owner vẫn không xác nhận, hệ thống tự động mở
    /// toàn bộ phần owner đã phân cho người này. Cần hoàn tất lời mời + tạo khoá cá nhân TRƯỚC (phần được
    /// niêm phong bằng khoá công khai của họ).
    /// </summary>
    Recipient = 1,

    /// <summary>
    /// Người nhắc nhở: được báo khi owner không còn xác nhận, việc duy nhất là liên lạc và nhắc owner bấm
    /// "Tôi vẫn ổn". Không nhận bất kỳ thông tin nào trong két và không cần tạo khoá.
    /// </summary>
    Reminder = 2
}
