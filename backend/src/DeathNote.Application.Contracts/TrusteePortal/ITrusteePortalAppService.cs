using DeathNote.Common;
using Volo.Abp.Application.Services;

namespace DeathNote.TrusteePortal;

/// <summary>
/// API dành cho người được uỷ quyền: nhận lời mời, tạo khoá cá nhân, người nhắc nhở phản hồi, người nhận
/// mở hộp nhận sau khi hồ sơ được bàn giao tự động.
/// </summary>
public interface ITrusteePortalAppService : IApplicationService
{
    Task<InvitationDto> GetInvitationAsync(string token);
    Task<AssignmentDto> AcceptInvitationAsync(AcceptInvitationInput input);
    Task<KeyringDto> GetKeyringAsync();
    Task<KeyringDto> CreateKeyringAsync(CreateKeyringInput input);
    Task<List<AssignmentDto>> GetAssignmentsAsync();
    Task RespondContactAsync(ContactResponseInput input);
    Task<InboxDto> GetInboxAsync(Guid trusteeId);
    Task<List<ReleasedItemDto>> GetReleasedItemsAsync(GetReleasedItemsInput input);
    Task<List<AuditEventDto>> GetActivityAsync(Guid trusteeId);
}
