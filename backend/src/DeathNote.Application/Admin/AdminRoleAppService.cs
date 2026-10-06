using DeathNote.AuditTrail;
using DeathNote.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Volo.Abp;
using Volo.Abp.Authorization.Permissions;
using Volo.Abp.Identity;
using Volo.Abp.Localization;
using Volo.Abp.PermissionManagement;
using IdentityRole = Volo.Abp.Identity.IdentityRole;

namespace DeathNote.Admin;

/// <summary>
/// Vai trò động cho console vận hành: tạo, đổi tên, xoá vai trò và chọn quyền (chỉ các quyền thuộc nhóm "DeathNote").
/// <para>Vai trò hệ thống <c>admin</c> luôn toàn quyền (ABP tự cấp mọi quyền) nên không sửa/xoá được.</para>
/// </summary>
[Authorize(DeathNotePermissions.Roles.Default)]
public class AdminRoleAppService : DeathNoteAppService, IAdminRoleAppService
{
    private readonly IIdentityRoleRepository _roles;
    private readonly IIdentityUserRepository _users;
    private readonly IdentityRoleManager _roleManager;
    private readonly IPermissionManager _permissionManager;
    private readonly IPermissionGrantRepository _grants;
    private readonly IPermissionDefinitionManager _definitions;

    public AdminRoleAppService(IIdentityRoleRepository roles, IIdentityUserRepository users, IdentityRoleManager roleManager,
        IPermissionManager permissionManager, IPermissionGrantRepository grants, IPermissionDefinitionManager definitions)
    {
        _roles = roles;
        _users = users;
        _roleManager = roleManager;
        _permissionManager = permissionManager;
        _grants = grants;
        _definitions = definitions;
    }

    public async Task<List<RoleDto>> GetListAsync()
    {
        var catalog = (await GetCatalogAsync()).Select(p => p.Name).ToHashSet();
        var result = new List<RoleDto>();
        foreach (var role in (await _roles.GetListAsync()).OrderBy(r => !IsSystem(r)).ThenBy(r => r.Name))
            result.Add(await ToDtoAsync(role, catalog));
        return result;
    }

    /// <summary>Cây quyền của console theo đúng thứ tự khai báo — dùng để dựng ô chọn quyền.</summary>
    public async Task<List<PermissionItemDto>> GetPermissionsAsync() => await GetCatalogAsync();

    [Authorize(DeathNotePermissions.Roles.Create)]
    public async Task<RoleDto> CreateAsync(SaveRoleInput input)
    {
        var name = input.Name.Trim();
        var role = new IdentityRole(GuidGenerator.Create(), name) { IsPublic = true };
        (await _roleManager.CreateAsync(role)).CheckErrors();
        var granted = await SetPermissionsAsync(name, input.Permissions);

        await RecordAsync(AuditActions.RoleCreated, name, $"{granted.Count} quyền: {string.Join(", ", granted)}");
        return await ToDtoAsync(role, null);
    }

    [Authorize(DeathNotePermissions.Roles.Update)]
    public async Task<RoleDto> UpdateAsync(Guid id, SaveRoleInput input)
    {
        var role = await _roleManager.GetByIdAsync(id);
        EnsureEditable(role);
        var oldName = role.Name;
        var newName = input.Name.Trim();
        var before = await GetGrantedAsync(oldName);

        if (oldName != newName)
        {
            (await _roleManager.SetRoleNameAsync(role, newName)).CheckErrors();
            (await _roleManager.UpdateAsync(role)).CheckErrors();
            // Quyền gắn theo TÊN vai trò → xoá bản ghi theo tên cũ, cấp lại đầy đủ theo tên mới ngay bên dưới.
            await _permissionManager.DeleteAsync(RolePermissionValueProvider.ProviderName, oldName);
        }
        var after = await SetPermissionsAsync(newName, input.Permissions);

        var changes = new List<string>();
        if (oldName != newName) changes.Add($"đổi tên \"{oldName}\" → \"{newName}\"");
        var added = after.Except(before).ToList();
        var removed = before.Except(after).ToList();
        if (added.Count > 0) changes.Add($"thêm quyền: {string.Join(", ", added)}");
        if (removed.Count > 0) changes.Add($"bỏ quyền: {string.Join(", ", removed)}");
        if (changes.Count > 0) await RecordAsync(AuditActions.RoleUpdated, newName, string.Join("; ", changes));
        return await ToDtoAsync(role, null);
    }

    [Authorize(DeathNotePermissions.Roles.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var role = await _roleManager.GetByIdAsync(id);
        EnsureEditable(role);
        var userCount = await _users.GetCountAsync(roleId: id);
        if (userCount > 0)
            throw new UserFriendlyException($"Vai trò \"{role.Name}\" đang được gán cho {userCount} nhân viên — gỡ vai trò khỏi họ trước khi xoá.");

        (await _roleManager.DeleteAsync(role)).CheckErrors();
        await _permissionManager.DeleteAsync(RolePermissionValueProvider.ProviderName, role.Name);
        await RecordAsync(AuditActions.RoleDeleted, role.Name, null);
    }

    // =====================================================================

    private static bool IsSystem(IdentityRole r) => r.IsStatic || r.Name == DeathNoteConsts.Roles.SuperAdmin;

    private static void EnsureEditable(IdentityRole role)
    {
        if (IsSystem(role)) throw new UserFriendlyException("Vai trò Quản trị hệ thống luôn toàn quyền — không sửa hay xoá được.");
    }

    /// <summary>Cấp đúng tập quyền đã chọn (kèm quyền cha của mỗi quyền con), thu hồi phần còn lại. Trả về tập đã cấp.</summary>
    private async Task<List<string>> SetPermissionsAsync(string roleName, IEnumerable<string> selected)
    {
        var catalog = await GetCatalogAsync();
        var byName = catalog.ToDictionary(p => p.Name);
        var unknown = selected.Where(n => !byName.ContainsKey(n)).ToList();
        if (unknown.Count > 0) throw new UserFriendlyException($"Quyền không hợp lệ: {string.Join(", ", unknown)}");

        // Quyền con chỉ có nghĩa khi có quyền cha (vd. "Sửa chính sách" cần "Xem chính sách").
        var wanted = new HashSet<string>();
        foreach (var name in selected)
            for (var p = byName[name]; p != null; p = p.ParentName == null ? null : byName[p.ParentName])
                wanted.Add(p.Name);

        foreach (var p in catalog)
            await _permissionManager.SetForRoleAsync(roleName, p.Name, wanted.Contains(p.Name));
        return catalog.Select(p => p.Name).Where(wanted.Contains).ToList();
    }

    private async Task<List<string>> GetGrantedAsync(string roleName) =>
        (await _grants.GetListAsync(RolePermissionValueProvider.ProviderName, roleName)).Select(g => g.Name).ToList();

    private async Task<List<PermissionItemDto>> GetCatalogAsync()
    {
        var group = (await _definitions.GetGroupsAsync()).Single(g => g.Name == DeathNotePermissions.GroupName);
        return group.GetPermissionsWithChildren().Select(p => new PermissionItemDto
        {
            Name = p.Name,
            DisplayName = p.DisplayName.Localize(StringLocalizerFactory),
            ParentName = p.Parent?.Name
        }).ToList();
    }

    private async Task<RoleDto> ToDtoAsync(IdentityRole role, HashSet<string>? catalog)
    {
        catalog ??= (await GetCatalogAsync()).Select(p => p.Name).ToHashSet();
        return new RoleDto
        {
            Id = role.Id,
            Name = role.Name,
            IsStatic = IsSystem(role),
            UserCount = (int)await _users.GetCountAsync(roleId: role.Id),
            // admin: ABP cấp mọi quyền khi seed → coi như toàn quyền.
            Permissions = IsSystem(role) ? catalog.ToList() : (await GetGrantedAsync(role.Name)).Where(catalog.Contains).ToList()
        };
    }

    private Task RecordAsync(string action, string roleName, string? detail) =>
        Audit.RecordAsync(new AuditEntry(action, ActorType: AuditActorType.Admin, ActorUserId: UserId, ActorName: CurrentUserDisplayName,
            TargetType: "Role", TargetId: roleName, Detail: detail));
}
