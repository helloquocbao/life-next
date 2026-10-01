using DeathNote.Common;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace DeathNote.Owners;

/// <summary>API dành cho owner: trạng thái, check-in, cấu hình nhịp, tạm dừng, nhật ký, diễn tập.</summary>
public interface IOwnerAppService : IApplicationService
{
    Task<OwnerStatusDto> GetStatusAsync();
    Task<OwnerStatusDto> CompleteOnboardingAsync(CompleteOnboardingInput input);
    Task<CheckInResultDto> CheckInAsync(CheckInInput input);
    /// <summary>Check-in một chạm từ link trong email/SMS — không cần đăng nhập.</summary>
    Task<CheckInByLinkResultDto> CheckInByLinkAsync(CheckInByLinkInput input);
    Task UpdateScheduleAsync(UpdateScheduleInput input);
    Task UpdateContactAsync(UpdateContactInput input);
    Task PauseAsync(PauseInput input);
    Task ResumeAsync();
    Task ConfirmRecoveryKitAsync();
    Task SetStaffContactOnMissedAsync(SetStaffContactOnMissedInput input);
    Task<List<HeartbeatDto>> GetHeartbeatsAsync();
    Task<PagedResultDto<AuditEventDto>> GetActivityAsync(GetActivityInput input);
    Task<DryRunDto> GetDryRunAsync();
    Task<TwoFactorSetupDto> GetTwoFactorSetupAsync();
    Task EnableTwoFactorAsync(EnableTwoFactorInput input);
    Task DisableTwoFactorAsync(EnableTwoFactorInput input);
    /// <summary>Kiểm tra mã 2FA ở bước mở két (sau khi passphrase đã giải mã VaultKey trên trình duyệt).</summary>
    Task<bool> VerifyVaultUnlockCodeAsync(EnableTwoFactorInput input);
    /// <summary>
    /// Tắt 2FA khi mất thiết bị xác thực — KHÔNG cần mã 6 số. Chỉ gọi được sau khi trình duyệt đã tự
    /// xác minh 12 từ khôi phục thành công (xem RecoveryTwoFactorModal.tsx phía frontend).
    /// </summary>
    Task DisableTwoFactorViaRecoveryAsync();
}
