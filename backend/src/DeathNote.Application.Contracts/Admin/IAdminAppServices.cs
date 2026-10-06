using DeathNote.Common;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace DeathNote.Admin;

/// <summary>Dashboard + hồ sơ quyền của admin.</summary>
public interface IAdminDashboardAppService : IApplicationService
{
    Task<AdminProfileDto> GetProfileAsync();
    Task<AdminDashboardDto> GetAsync();
    Task<PolicyDto> GetPolicyAsync();
    Task<PolicyDto> UpdatePolicyAsync(UpdatePolicyInput input);
}

/// <summary>Danh sách khách hàng (owner) — chỉ đọc, chỉ metadata; email & SĐT bị che trừ khi có quyền xem.</summary>
public interface IAdminCustomerAppService : IApplicationService
{
    Task<PagedResultDto<CustomerDto>> GetListAsync(GetCustomersInput input);
    Task<CustomerContactDto> GetContactAsync(Guid id);
}

/// <summary>Nhân viên vận hành và vai trò của họ.</summary>
public interface IAdminStaffAppService : IApplicationService
{
    Task<PagedResultDto<StaffDto>> GetListAsync(GetStaffInput input);
    Task<StaffDto> CreateAsync(CreateStaffInput input);
    Task<StaffDto> UpdateAsync(Guid id, UpdateStaffInput input);
    /// <summary>Tên các vai trò có thể gán cho nhân viên.</summary>
    Task<List<string>> GetAssignableRolesAsync();
}

/// <summary>Vai trò động: tạo, đổi tên, xoá và chọn quyền cho từng vai trò.</summary>
public interface IAdminRoleAppService : IApplicationService
{
    Task<List<RoleDto>> GetListAsync();
    Task<List<PermissionItemDto>> GetPermissionsAsync();
    Task<RoleDto> CreateAsync(SaveRoleInput input);
    Task<RoleDto> UpdateAsync(Guid id, SaveRoleInput input);
    Task DeleteAsync(Guid id);
}

/// <summary>Audit log toàn hệ thống + kiểm tra toàn vẹn chuỗi băm.</summary>
public interface IAdminAuditAppService : IApplicationService
{
    Task<PagedResultDto<AuditEventDto>> GetListAsync(GetAuditLogInput input);
    Task<ChainVerificationDto> VerifyChainAsync();
}
