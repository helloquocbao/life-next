using DeathNote.Common;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Content;

namespace DeathNote.Admin;

/// <summary>Dashboard + hồ sơ quyền của admin.</summary>
public interface IAdminDashboardAppService : IApplicationService
{
    Task<AdminProfileDto> GetProfileAsync();
    Task<AdminDashboardDto> GetAsync();
    Task<PolicyDto> GetPolicyAsync();
}

/// <summary>Hàng chờ và thẩm định yêu cầu mở vault.</summary>
public interface IReleaseReviewAppService : IApplicationService
{
    Task<PagedResultDto<ReleaseQueueItemDto>> GetQueueAsync(GetReleaseQueueInput input);
    Task<ReleaseCaseDto> GetAsync(Guid id);
    Task<ReleaseCaseDto> VoteAsync(Guid id, CastVoteInput input);
    Task<IRemoteStreamContent> GetEvidenceFileAsync(Guid evidenceId);
}

/// <summary>Audit log toàn hệ thống + kiểm tra toàn vẹn chuỗi băm.</summary>
public interface IAdminAuditAppService : IApplicationService
{
    Task<PagedResultDto<AuditEventDto>> GetListAsync(GetAuditLogInput input);
    Task<ChainVerificationDto> VerifyChainAsync();
}
