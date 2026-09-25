using DeathNote.Common;
using DeathNote.Releases;
using Volo.Abp.Application.Services;
using Volo.Abp.Content;

namespace DeathNote.TrusteePortal;

/// <summary>
/// API dành cho người được uỷ quyền: nhận lời mời, tạo khoá cá nhân, trả lời cảnh báo,
/// khởi tạo/đồng thuận yêu cầu mở, nộp bằng chứng, mở hộp nhận sau khi phát hành.
/// </summary>
public interface ITrusteePortalAppService : IApplicationService
{
    Task<InvitationDto> GetInvitationAsync(string token);
    Task<AssignmentDto> AcceptInvitationAsync(AcceptInvitationInput input);
    Task<KeyringDto> GetKeyringAsync();
    Task<KeyringDto> CreateKeyringAsync(CreateKeyringInput input);
    Task<List<AssignmentDto>> GetAssignmentsAsync();
    Task RespondContactAsync(ContactResponseInput input);
    Task<ReleaseProgressDto> InitiateReleaseAsync(InitiateReleaseInput input);
    Task<ConsentMaterialDto> GetConsentMaterialAsync(Guid requestId);
    Task<ReleaseProgressDto> ConsentAsync(Guid requestId, ConsentInput input);
    Task<EvidenceBriefDto> UploadEvidenceAsync(Guid requestId, EvidenceKind kind, IRemoteStreamContent file);
    Task<ReleaseProgressDto> ResubmitAsync(Guid requestId);
    Task<InboxDto> GetInboxAsync(Guid trusteeId);
    Task<List<ReleasedItemDto>> GetReleasedItemsAsync(GetReleasedItemsInput input);
    Task<List<AuditEventDto>> GetActivityAsync(Guid trusteeId);
}
