using DeathNote.Localization;
using Volo.Abp.Authorization.Permissions;
using Volo.Abp.Localization;

namespace DeathNote.Permissions;

/// <summary>Khai báo cây quyền của Admin console với hệ thống permission của ABP.</summary>
public class DeathNotePermissionDefinitionProvider : PermissionDefinitionProvider
{
    public override void Define(IPermissionDefinitionContext context)
    {
        var group = context.AddGroup(DeathNotePermissions.GroupName, L("Vận hành Death Note"));

        group.AddPermission(DeathNotePermissions.Dashboard, L("Xem tổng quan vận hành"));

        var customers = group.AddPermission(DeathNotePermissions.Customers.Default, L("Xem danh sách khách hàng (email, SĐT bị che)"));
        customers.AddChild(DeathNotePermissions.Customers.ViewContact, L("Xem email & số điện thoại khách hàng"));

        var staff = group.AddPermission(DeathNotePermissions.Staff.Default, L("Xem danh sách nhân viên"));
        staff.AddChild(DeathNotePermissions.Staff.Create, L("Thêm nhân viên"));
        staff.AddChild(DeathNotePermissions.Staff.Update, L("Sửa thông tin & vai trò nhân viên"));
        staff.AddChild(DeathNotePermissions.Staff.Lock, L("Khoá / mở khoá nhân viên"));
        staff.AddChild(DeathNotePermissions.Staff.ResetPassword, L("Đặt lại mật khẩu nhân viên"));

        var roles = group.AddPermission(DeathNotePermissions.Roles.Default, L("Xem vai trò và quyền"));
        roles.AddChild(DeathNotePermissions.Roles.Create, L("Tạo vai trò"));
        roles.AddChild(DeathNotePermissions.Roles.Update, L("Sửa vai trò & chọn quyền"));
        roles.AddChild(DeathNotePermissions.Roles.Delete, L("Xoá vai trò"));

        group.AddPermission(DeathNotePermissions.AuditLog, L("Xem audit log toàn hệ thống"));

        var policy = group.AddPermission(DeathNotePermissions.Policy.Default, L("Xem chính sách vòng đời"));
        policy.AddChild(DeathNotePermissions.Policy.Manage, L("Sửa chính sách"));

        var templates = group.AddPermission(DeathNotePermissions.EmailTemplates.Default, L("Xem mẫu email"));
        templates.AddChild(DeathNotePermissions.EmailTemplates.Manage, L("Sửa / khôi phục / gửi thử mẫu email"));
    }

    private static LocalizableString L(string name) => LocalizableString.Create<DeathNoteResource>(name);
}
