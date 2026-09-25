using DeathNote.Permissions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Guids;
using Volo.Abp.Identity;
using Volo.Abp.PermissionManagement;
using Volo.Abp.Authorization.Permissions;

namespace DeathNote.Data;

/// <summary>
/// Seed vai trò nội bộ của PICO (đúng bảng "Phân quyền nội bộ") và — khi bật cờ demo — các tài khoản mẫu
/// để trình diễn trọn quy trình: 1 owner, 3 trustee, 1 reviewer, 1 approver, 1 support, 1 compliance.
/// <para>Tài khoản admin hệ thống (admin / 1q2w3E*) do module Identity của ABP tự seed.</para>
/// </summary>
public class DeathNoteIdentitySeedContributor : IDataSeedContributor, ITransientDependency
{
    private readonly IdentityRoleManager _roleManager;
    private readonly IdentityUserManager _userManager;
    private readonly IIdentityRoleRepository _roleRepository;
    private readonly IPermissionDataSeeder _permissionSeeder;
    private readonly IGuidGenerator _guid;
    private readonly IConfiguration _configuration;

    public DeathNoteIdentitySeedContributor(IdentityRoleManager roleManager, IdentityUserManager userManager,
        IIdentityRoleRepository roleRepository, IPermissionDataSeeder permissionSeeder, IGuidGenerator guid, IConfiguration configuration)
    {
        _roleManager = roleManager;
        _userManager = userManager;
        _roleRepository = roleRepository;
        _permissionSeeder = permissionSeeder;
        _guid = guid;
        _configuration = configuration;
    }

    public async Task SeedAsync(DataSeedContext context)
    {
        
        await SeedRoleAsync(DeathNoteConsts.Roles.Support,
            DeathNotePermissions.Dashboard, DeathNotePermissions.Releases.Default);
        await SeedRoleAsync(DeathNoteConsts.Roles.Reviewer,
            DeathNotePermissions.Dashboard, DeathNotePermissions.Releases.Default, DeathNotePermissions.Releases.Evidence,
            DeathNotePermissions.Releases.Review, DeathNotePermissions.AuditLog);
        await SeedRoleAsync(DeathNoteConsts.Roles.Approver,
            DeathNotePermissions.Dashboard, DeathNotePermissions.Releases.Default, DeathNotePermissions.Releases.Evidence,
            DeathNotePermissions.Releases.Approve, DeathNotePermissions.AuditLog);
        await SeedRoleAsync(DeathNoteConsts.Roles.Compliance,
            DeathNotePermissions.Dashboard, DeathNotePermissions.Releases.Default, DeathNotePermissions.Releases.Evidence,
            DeathNotePermissions.AuditLog, DeathNotePermissions.Policy.Default);


        if (!_configuration.GetValue<bool>("DeathNote:SeedDemoUsers")) return;

        var password = _configuration["DeathNote:DemoPassword"] ?? "Demo@123";
        await SeedUserAsync("reviewer", "Trần Thẩm Định", "reviewer@deathnote.local", password, DeathNoteConsts.Roles.Reviewer);
        await SeedUserAsync("approver", "Lê Phê Duyệt", "approver@deathnote.local", password, DeathNoteConsts.Roles.Approver);
        await SeedUserAsync("support", "Phạm Hỗ Trợ", "support@deathnote.local", password, DeathNoteConsts.Roles.Support);
        await SeedUserAsync("compliance", "Vũ Tuân Thủ", "compliance@deathnote.local", password, DeathNoteConsts.Roles.Compliance);
        await SeedUserAsync("owner", "Nguyễn Văn An", "owner@deathnote.local", password, null);
        await SeedUserAsync("trustee1", "Nguyễn Thị Bình", "trustee1@deathnote.local", password, null);
        await SeedUserAsync("trustee2", "Nguyễn Minh Châu", "trustee2@deathnote.local", password, null);
        await SeedUserAsync("trustee3", "Luật sư Đỗ Dũng", "trustee3@deathnote.local", password, null);
    }

    private async Task SeedRoleAsync(string roleName, params string[] permissions)
    {
        if (await _roleRepository.FindByNormalizedNameAsync(roleName.ToUpperInvariant()) == null)
        {
            var role = new IdentityRole(_guid.Create(), roleName) { IsPublic = true };
            (await _roleManager.CreateAsync(role)).CheckErrors();
        }
        await _permissionSeeder.SeedAsync(RolePermissionValueProvider.ProviderName, roleName, permissions);
    }

    private async Task SeedUserAsync(string userName, string name, string email, string password, string? role)
    {
        if (await _userManager.FindByNameAsync(userName) != null) return;
        var user = new IdentityUser(_guid.Create(), userName, email) { Name = name };
        user.SetEmailConfirmed(true);
        (await _userManager.CreateAsync(user, password)).CheckErrors();
        if (role != null) (await _userManager.AddToRoleAsync(user, role)).CheckErrors();
    }
}
