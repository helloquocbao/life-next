namespace DeathNote.Permissions;

/// <summary>
/// Tên quyền của Admin console (đội vận hành PICO).
/// <para>
/// Owner và Trustee KHÔNG dùng hệ thống permission: quyền của họ được xác định theo quan hệ dữ liệu
/// (chủ hồ sơ / người được mời) và được kiểm tra trực tiếp trong application service.
/// </para>
/// Ánh xạ tới bảng "Phân quyền nội bộ" trong tài liệu thiết kế:
/// <code>
/// Đây là phân quyền MẶC ĐỊNH khi vai trò được tạo lần đầu — sau đó admin chỉnh tự do ở màn hình "Vai trò".
/// Role        | Dashboard | Khách hàng | Nhân viên | Chính sách | Audit
/// Support     | Có        | Xem        | Không     | Không      | Không
/// Reviewer    | Có        | Xem        | Không     | Không      | Có
/// Approver    | Có        | Xem        | Không     | Không      | Có
/// Compliance  | Có        | Xem        | Xem       | Xem        | Toàn bộ
/// Super admin | Có        | Xem        | Quản lý   | Chỉnh sửa  | Toàn bộ
/// </code>
/// </summary>
public static class DeathNotePermissions
{
    public const string GroupName = "DeathNote";

    public const string Dashboard = GroupName + ".Dashboard";

    /// <summary>Khách hàng (owner): trạng thái vòng đời, metadata két — không bao giờ có nội dung két.</summary>
    public static class Customers
    {
        /// <summary>Xem danh sách — email & số điện thoại luôn bị che.</summary>
        public const string Default = GroupName + ".Customers";
        /// <summary>Hiện email & số điện thoại đầy đủ của từng khách hàng (mỗi lần xem ghi audit).</summary>
        public const string ViewContact = Default + ".ViewContact";
    }

    /// <summary>Nhân viên vận hành và vai trò của họ.</summary>
    public static class Staff
    {
        public const string Default = GroupName + ".Staff";
        public const string Create = Default + ".Create";
        /// <summary>Sửa họ tên, email, vai trò.</summary>
        public const string Update = Default + ".Update";
        /// <summary>Khoá / mở khoá đăng nhập.</summary>
        public const string Lock = Default + ".Lock";
        public const string ResetPassword = Default + ".ResetPassword";
    }

    /// <summary>Vai trò và quyền của từng vai trò.</summary>
    public static class Roles
    {
        public const string Default = GroupName + ".Roles";
        public const string Create = Default + ".Create";
        /// <summary>Đổi tên vai trò và chọn quyền cho vai trò.</summary>
        public const string Update = Default + ".Update";
        public const string Delete = Default + ".Delete";
    }

    public const string AuditLog = GroupName + ".AuditLog";

    public static class Policy
    {
        public const string Default = GroupName + ".Policy";
        public const string Manage = Default + ".Manage";
    }

    /// <summary>Mẫu email gửi cho owner/trustee: xem và chỉnh sửa nội dung.</summary>
    public static class EmailTemplates
    {
        public const string Default = GroupName + ".EmailTemplates";
        public const string Manage = Default + ".Manage";
    }
}
