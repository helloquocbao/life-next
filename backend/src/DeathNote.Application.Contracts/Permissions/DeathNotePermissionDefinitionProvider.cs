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

        group.AddPermission(DeathNotePermissions.Dashboard, L("Dashboard vận hành"));

        var releases = group.AddPermission(DeathNotePermissions.Releases.Default, L("Xem hàng chờ mở vault"));
        releases.AddChild(DeathNotePermissions.Releases.Evidence, L("Xem giấy tờ bằng chứng"));
        releases.AddChild(DeathNotePermissions.Releases.Review, L("Phiếu thẩm định (phiếu 1)"));
        releases.AddChild(DeathNotePermissions.Releases.Approve, L("Phiếu phê duyệt (phiếu 2)"));

        group.AddPermission(DeathNotePermissions.AuditLog, L("Audit log toàn hệ thống"));

        var policy = group.AddPermission(DeathNotePermissions.Policy.Default, L("Xem chính sách vòng đời"));
        policy.AddChild(DeathNotePermissions.Policy.Manage, L("Đề xuất thay đổi chính sách"));

        var templates = group.AddPermission(DeathNotePermissions.EmailTemplates.Default, L("Xem mẫu email"));
        templates.AddChild(DeathNotePermissions.EmailTemplates.Manage, L("Chỉnh sửa mẫu email"));
    }

    private static LocalizableString L(string name) => LocalizableString.Create<DeathNoteResource>(name);
}
