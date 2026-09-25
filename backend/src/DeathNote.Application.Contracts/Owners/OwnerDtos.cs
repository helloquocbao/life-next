using System.ComponentModel.DataAnnotations;
using DeathNote.Lifecycle;
using DeathNote.Releases;

namespace DeathNote.Owners;

/// <summary>
/// Toàn bộ dữ liệu cho màn hình Home của owner — trả lời một câu hỏi duy nhất:
/// "Bạn đang ổn. Lần check-in tiếp theo: 12 ngày nữa."
/// </summary>
public class OwnerStatusDto
{
    /// <summary>False nếu người dùng chưa làm onboarding.</summary>
    public bool HasProfile { get; set; }
    public string? DisplayName { get; set; }
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }

    // Tầng 1 — trạng thái
    public LifecycleState State { get; set; }
    public DateTime StateChangedAt { get; set; }
    public DateTime? LastCheckInAt { get; set; }
    public DateTime NextCheckInDueAt { get; set; }
    public int CheckInIntervalDays { get; set; }
    public int GraceDays { get; set; }
    public int RemindersSent { get; set; }
    public int ReminderSteps { get; set; }
    /// <summary>Mốc dự kiến người thân được báo (khi đang Missed).</summary>
    public DateTime? TrusteesNotifiedAt { get; set; }
    /// <summary>Mốc hết thời gian ân hạn (khi đang Grace) — sau mốc này người thân có thể yêu cầu mở.</summary>
    public DateTime? GraceEndsAt { get; set; }
    public DateTime? PausedUntil { get; set; }
    public string? PauseReason { get; set; }
    public OpenReleaseSummaryDto? OpenRelease { get; set; }

    // Tầng 2 — mức độ sẵn sàng
    public ReadinessDto Readiness { get; set; } = new();

    // Tầng 3 — tóm tắt
    public bool VaultInitialized { get; set; }
    public int ItemCount { get; set; }
    public long VaultSizeBytes { get; set; }
    public int TrusteeCount { get; set; }
    public int ConfirmedTrusteeCount { get; set; }
    public int? Threshold { get; set; }
    public int? KeyHolderCount { get; set; }
    public bool KeysDistributed { get; set; }
    public bool KeysOutdated { get; set; }
    public DateTime? LastVaultUpdateAt { get; set; }
    public bool RecoveryKitConfirmed { get; set; }
    public bool CheckInTwoFactorEnabled { get; set; }

    /// <summary>Giờ server — client dùng để tính đếm ngược chính xác dù đồng hồ máy lệch.</summary>
    public DateTime ServerNow { get; set; }
    /// <summary>Hệ số nén thời gian (demo). Client quy đổi "ngày" hiển thị cho đúng.</summary>
    public double TimeScale { get; set; }
}

public class OpenReleaseSummaryDto
{
    public Guid Id { get; set; }
    public ReleaseStatus Status { get; set; }
    public ReleaseReason Reason { get; set; }
    public string InitiatorName { get; set; } = default!;
    public DateTime InitiatedAt { get; set; }
    public int EffectiveConsents { get; set; }
    public int RequiredConsents { get; set; }
    public DateTime? FinalWaitUntil { get; set; }
}

/// <summary>Thanh "Mức độ sẵn sàng" + một việc nên làm tiếp.</summary>
public class ReadinessDto
{
    public int Score { get; set; }
    public List<ReadinessCheckDto> Checks { get; set; } = new();
    public string? NextActionCode { get; set; }
}

public class ReadinessCheckDto
{
    public string Code { get; set; } = default!;
    public string Label { get; set; } = default!;
    public bool Done { get; set; }
    public int Weight { get; set; }
}

public class CompleteOnboardingInput
{
    [Required, StringLength(128)] public string DisplayName { get; set; } = default!;
    [StringLength(32)] public string? PhoneNumber { get; set; }
    public int CheckInIntervalDays { get; set; } = 30;
    public int GraceDays { get; set; } = 14;
}

public class CheckInInput
{
    /// <summary>Mã TOTP 6 số — bắt buộc khi owner đã bật 2FA cho check-in.</summary>
    [StringLength(8)] public string? TwoFactorCode { get; set; }
}

public class CheckInResultDto
{
    public LifecycleState PreviousState { get; set; }
    /// <summary>True nếu lần check-in này đã huỷ một tiến trình cảnh báo/xác minh (quyền phủ quyết).</summary>
    public bool WasVeto { get; set; }
    public DateTime NextCheckInDueAt { get; set; }
}

public class CheckInByLinkInput
{
    [Required] public string Token { get; set; } = default!;
}

public class CheckInByLinkResultDto
{
    public string DisplayName { get; set; } = default!;
    public bool WasVeto { get; set; }
    public DateTime NextCheckInDueAt { get; set; }
}

public class UpdateScheduleInput
{
    public int CheckInIntervalDays { get; set; }
    public int GraceDays { get; set; }
}

public class UpdateContactInput
{
    [Required, StringLength(128)] public string DisplayName { get; set; } = default!;
    [StringLength(32)] public string? PhoneNumber { get; set; }
}

public class PauseInput
{
    public DateTime Until { get; set; }
    [StringLength(256)] public string? Reason { get; set; }
}

public class HeartbeatDto
{
    public DateTime OccurredAt { get; set; }
    public CheckInChannel Channel { get; set; }
    public string? IpAddress { get; set; }
    public bool WasVeto { get; set; }
}

/// <summary>Diễn tập (dry run): owner xem trước toàn bộ quy trình sẽ diễn ra nếu mình im lặng.</summary>
public class DryRunDto
{
    public List<DryRunStepDto> Steps { get; set; } = new();
    public double TotalDays { get; set; }
    public bool IsReady { get; set; }
    public List<string> Blockers { get; set; } = new();
}

public class DryRunStepDto
{
    public LifecycleState State { get; set; }
    public string Title { get; set; } = default!;
    public string Description { get; set; } = default!;
    /// <summary>Thời lượng giai đoạn theo "ngày nghiệp vụ" (chưa nén).</summary>
    public double DurationDays { get; set; }
    public bool OwnerCanCancel { get; set; }
}

public class TwoFactorSetupDto
{
    public string SharedKey { get; set; } = default!;
    public string AuthenticatorUri { get; set; } = default!;
}

public class EnableTwoFactorInput
{
    [Required, StringLength(8)] public string Code { get; set; } = default!;
}

public class GetActivityInput
{
    public int SkipCount { get; set; }
    [Range(1, 200)] public int MaxResultCount { get; set; } = 50;
}
