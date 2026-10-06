using DeathNote.AuditTrail;
using DeathNote.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Microsoft.AspNetCore.Identity;
using Volo.Abp.Identity;
using IdentityUser = Volo.Abp.Identity.IdentityUser;
using IdentityRole = Volo.Abp.Identity.IdentityRole;

namespace DeathNote.Admin;

/// <summary>
/// Nhân viên vận hành = tài khoản có ít nhất một vai trò (vai trò tạo động ở màn hình "Vai trò").
/// Khách hàng (owner/người được uỷ quyền) không có vai trò nào nên không bao giờ xuất hiện hay bị sửa ở đây.
/// </summary>
[Authorize(DeathNotePermissions.Staff.Default)]
public class AdminStaffAppService : DeathNoteAppService, IAdminStaffAppService
{
    private readonly IRepository<IdentityUser, Guid> _users;
    private readonly IRepository<IdentityRole, Guid> _roles;
    private readonly IdentityUserManager _userManager;

    public AdminStaffAppService(IRepository<IdentityUser, Guid> users, IRepository<IdentityRole, Guid> roles, IdentityUserManager userManager)
    {
        _users = users;
        _roles = roles;
        _userManager = userManager;
    }

    public async Task<PagedResultDto<StaffDto>> GetListAsync(GetStaffInput input)
    {
        var staffRoles = await GetRoleNamesAsync();
        var query = (await _users.GetQueryableAsync()).Where(u => u.Roles.Any());
        if (!string.IsNullOrWhiteSpace(input.Role))
        {
            var roleIds = staffRoles.Where(r => r.Value == input.Role).Select(r => r.Key).ToList();
            query = query.Where(u => u.Roles.Any(r => roleIds.Contains(r.RoleId)));
        }
        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            var f = input.Filter.Trim().ToUpperInvariant();
            query = query.Where(u => u.NormalizedUserName.Contains(f) || u.NormalizedEmail.Contains(f)
                                     || (u.Name != null && u.Name.ToUpper().Contains(f)));
        }

        var total = await AsyncExecuter.LongCountAsync(query);
        var page = await AsyncExecuter.ToListAsync(query.OrderBy(u => u.UserName).Skip(input.SkipCount).Take(input.MaxResultCount)
            .Select(u => new { User = u, RoleIds = u.Roles.Select(r => r.RoleId).ToList() }));
        return new PagedResultDto<StaffDto>(total, page.Select(x => ToDto(x.User, x.RoleIds, staffRoles)).ToList());
    }

    [Authorize(DeathNotePermissions.Staff.Create)]
    public async Task<StaffDto> CreateAsync(CreateStaffInput input)
    {
        await EnsureRolesExistAsync(input.Roles);
        var user = new IdentityUser(GuidGenerator.Create(), input.UserName.Trim(), input.Email.Trim()) { Name = input.Name?.Trim() };
        user.SetEmailConfirmed(true);
        (await _userManager.CreateAsync(user, input.Password)).CheckErrors();
        (await _userManager.SetRolesAsync(user, input.Roles)).CheckErrors();

        await RecordAsync(AuditActions.StaffCreated, user, $"Vai trò: {string.Join(", ", input.Roles)}");
        return await GetDtoAsync(user);
    }

    /// <summary>
    /// Mỗi loại thay đổi cần đúng quyền của nó: họ tên/email/vai trò → Staff.Update, khoá/mở khoá → Staff.Lock,
    /// đặt lại mật khẩu → Staff.ResetPassword. Trường không đổi thì không kiểm quyền (form gửi kèm giá trị hiện tại).
    /// </summary>
    public async Task<StaffDto> UpdateAsync(Guid id, UpdateStaffInput input)
    {
        await EnsureRolesExistAsync(input.Roles);
        var user = await _userManager.GetByIdAsync(id);
        var currentRoles = await _userManager.GetRolesAsync(user);
        if (currentRoles.Count == 0) throw new EntityNotFoundException(typeof(IdentityUser), id); // khách hàng, không phải nhân viên

        // Không tự khoá mình / tự gỡ quyền quản trị của mình → tránh mất hết người quản trị.
        if (id == UserId && !input.IsActive) throw new UserFriendlyException("Không thể tự khoá tài khoản của chính mình.");
        if (id == UserId && currentRoles.Contains(DeathNoteConsts.Roles.SuperAdmin) && !input.Roles.Contains(DeathNoteConsts.Roles.SuperAdmin))
            throw new UserFriendlyException("Không thể tự gỡ vai trò Quản trị hệ thống của chính mình.");

        var nameChanged = user.Name != input.Name?.Trim();
        var emailChanged = !string.Equals(user.Email, input.Email.Trim(), StringComparison.OrdinalIgnoreCase);
        var rolesChanged = !currentRoles.OrderBy(r => r).SequenceEqual(input.Roles.Distinct().OrderBy(r => r));
        var activeChanged = user.IsActive != input.IsActive;
        var passwordChanged = !string.IsNullOrEmpty(input.NewPassword);
        if (nameChanged || emailChanged || rolesChanged) await AuthorizationService.CheckAsync(DeathNotePermissions.Staff.Update);
        if (activeChanged) await AuthorizationService.CheckAsync(DeathNotePermissions.Staff.Lock);
        if (passwordChanged) await AuthorizationService.CheckAsync(DeathNotePermissions.Staff.ResetPassword);

        var changes = new List<string>();
        if (nameChanged) { user.Name = input.Name?.Trim(); changes.Add("họ tên"); }
        if (emailChanged)
        {
            (await _userManager.SetEmailAsync(user, input.Email.Trim())).CheckErrors();
            user.SetEmailConfirmed(true);
            changes.Add("email");
        }
        if (activeChanged) { user.SetIsActive(input.IsActive); changes.Add(input.IsActive ? "mở khoá" : "khoá"); }
        (await _userManager.UpdateAsync(user)).CheckErrors();

        if (rolesChanged)
        {
            (await _userManager.SetRolesAsync(user, input.Roles)).CheckErrors();
            changes.Add($"vai trò [{string.Join(", ", currentRoles)}] → [{string.Join(", ", input.Roles)}]");
        }
        if (passwordChanged)
        {
            (await _userManager.RemovePasswordAsync(user)).CheckErrors();
            (await _userManager.AddPasswordAsync(user, input.NewPassword)).CheckErrors();
            changes.Add("đặt lại mật khẩu");
        }

        if (changes.Count > 0) await RecordAsync(AuditActions.StaffUpdated, user, string.Join("; ", changes));
        return await GetDtoAsync(user);
    }

    public async Task<List<string>> GetAssignableRolesAsync() =>
        (await GetRoleNamesAsync()).Values.OrderBy(n => n).ToList();

    private async Task EnsureRolesExistAsync(IEnumerable<string> roles)
    {
        var existing = (await GetRoleNamesAsync()).Values.ToHashSet();
        if (roles.Any(r => !existing.Contains(r))) throw new UserFriendlyException("Vai trò không hợp lệ.");
    }

    /// <summary>RoleId → tên vai trò.</summary>
    private async Task<Dictionary<Guid, string>> GetRoleNamesAsync() =>
        (await _roles.GetListAsync()).ToDictionary(r => r.Id, r => r.Name);

    private async Task<StaffDto> GetDtoAsync(IdentityUser user)
    {
        var dto = ToDto(user, [], new Dictionary<Guid, string>());
        dto.Roles = (await _userManager.GetRolesAsync(user)).ToList();
        return dto;
    }

    private static StaffDto ToDto(IdentityUser u, IEnumerable<Guid> roleIds, Dictionary<Guid, string> roleNames) => new()
    {
        Id = u.Id,
        UserName = u.UserName,
        Name = u.Name,
        Email = u.Email,
        Roles = roleIds.Where(roleNames.ContainsKey).Select(id => roleNames[id]).OrderBy(n => n).ToList(),
        IsActive = u.IsActive,
        CreationTime = u.CreationTime
    };

    private Task RecordAsync(string action, IdentityUser user, string detail) =>
        Audit.RecordAsync(new AuditEntry(action, ActorType: AuditActorType.Admin, ActorUserId: UserId, ActorName: CurrentUserDisplayName,
            TargetType: "Staff", TargetId: user.UserName, Detail: detail));
}
