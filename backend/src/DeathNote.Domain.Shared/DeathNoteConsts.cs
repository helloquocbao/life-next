namespace DeathNote;

/// <summary>Hằng số cấp hệ thống.</summary>
public static class DeathNoteConsts
{
    /// <summary>Tiền tố bảng CSDL của nghiệp vụ Death Note, tách biệt khỏi bảng "Abp*" của framework.</summary>
    public const string DbTablePrefix = "Dn";

    /// <summary>Schema CSDL (null = schema mặc định "public" của PostgreSQL).</summary>
    public const string? DbSchema = null;

    /// <summary>
    /// Phiên bản định dạng mật mã phía client. Lưu kèm mọi ciphertext để sau này có thể
    /// nâng cấp thuật toán mà vẫn đọc được dữ liệu cũ (crypto agility).
    /// </summary>
    public const int CryptoVersion = 1;

    /// <summary>Giới hạn kích thước 1 hạng mục vault đã mã hoá (bao gồm tệp đính kèm nhỏ) cho MVP: 8 MB.</summary>
    public const int MaxVaultItemCiphertextLength = 8 * 1024 * 1024;

    /// <summary>Các nhịp check-in owner được chọn (ngày) — đúng như tài liệu thiết kế.</summary>
    public static readonly int[] AllowedCheckInIntervals = [7, 14, 30, 90];

    /// <summary>Tên vai trò hệ thống cho đội vận hành PICO (xem bảng "Phân quyền nội bộ").</summary>
    public static class Roles
    {
        public const string Support = "support";
        public const string Reviewer = "reviewer";
        public const string Approver = "approver";
        public const string Compliance = "compliance";
        /// <summary>Vai trò quản trị hệ thống mặc định của ABP. KHÔNG được quyền duyệt mở vault.</summary>
        public const string SuperAdmin = "admin";
    }
}
