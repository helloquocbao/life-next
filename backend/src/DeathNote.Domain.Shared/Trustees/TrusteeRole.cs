namespace DeathNote.Trustees;

/// <summary>Vai trò của một người được uỷ quyền trong hồ sơ của owner.</summary>
public enum TrusteeRole
{
    /// <summary>
    /// Người giữ mảnh khoá: nhận 1 mảnh Shamir của khoá phát hành. Đồng thuận của họ
    /// mới được tính vào ngưỡng m-of-n (vì chỉ họ đóng góp được mảnh khoá thật).
    /// </summary>
    KeyHolder = 0,
    /// <summary>Chỉ nhận nội dung được phân sau khi hồ sơ được mở; không tham gia đồng thuận.</summary>
    ContentOnly = 1,
    /// <summary>Người xác nhận: có thể khởi tạo yêu cầu và nộp bằng chứng, không giữ mảnh khoá.</summary>
    Verifier = 2
}
