namespace DeathNote.Permissions;

/// <summary>
/// Tên quyền của Admin console (đội vận hành PICO).
/// <para>
/// Owner và Trustee KHÔNG dùng hệ thống permission: quyền của họ được xác định theo quan hệ dữ liệu
/// (chủ hồ sơ / người được mời) và được kiểm tra trực tiếp trong application service.
/// </para>
/// Ánh xạ tới bảng "Phân quyền nội bộ" trong tài liệu thiết kế:
/// <code>
/// Role        | Xem hồ sơ          | Duyệt  | Chính sách | Audit
/// Support     | Có (ẩn bằng chứng) | Không  | Không      | Không
/// Reviewer    | Có                 | Phiếu 1| Không      | Có
/// Approver    | Có                 | Phiếu 2| Không      | Có
/// Compliance  | Có                 | Không  | Xem        | Toàn bộ
/// Super admin | Có                 | KHÔNG  | Quản lý    | Toàn bộ
/// </code>
/// </summary>
public static class DeathNotePermissions
{
    public const string GroupName = "DeathNote";

    public const string Dashboard = GroupName + ".Dashboard";

    public static class Releases
    {
        public const string Default = GroupName + ".Releases";
        /// <summary>Xem/tải tệp bằng chứng (CCCD, giấy chứng tử…). Support không có quyền này.</summary>
        public const string Evidence = Default + ".Evidence";
        /// <summary>Bỏ phiếu thẩm định thứ nhất.</summary>
        public const string Review = Default + ".Review";
        /// <summary>Bỏ phiếu phê duyệt thứ hai (phải là người khác phiếu 1).</summary>
        public const string Approve = Default + ".Approve";
    }

    public const string AuditLog = GroupName + ".AuditLog";

    public static class Policy
    {
        public const string Default = GroupName + ".Policy";
        public const string Manage = Default + ".Manage";
    }
}
