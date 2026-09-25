using Volo.Abp.Application.Services;

namespace DeathNote.Trustees;

/// <summary>Owner quản lý danh sách người được uỷ quyền.</summary>
public interface ITrusteeAppService : IApplicationService
{
    Task<List<TrusteeDto>> GetListAsync();
    Task<TrusteeDto> CreateAsync(SaveTrusteeInput input);
    Task<TrusteeDto> UpdateAsync(Guid id, SaveTrusteeInput input);
    Task DeleteAsync(Guid id);
    Task ResendInvitationAsync(Guid id);
}
