using System.ComponentModel.DataAnnotations;
using DeathNote.Lifecycle;
using DeathNote.Releases;
using DeathNote.Trustees;
using Volo.Abp.Application.Dtos;

namespace DeathNote.Admin;

/// <summary>Dashboard vận hành — CHỈ số liệu tổng hợp, không danh tính.</summary>
public class AdminDashboardDto
{
    public int PendingReviews { get; set; }
    public int SlaOverdue { get; set; }
    public int NeedsMoreInfo { get; set; }
    public int InFinalWait { get; set; }
    public int AwaitingConsent { get; set; }
    public int OwnersActive { get; set; }
    public int OwnersMissed { get; set; }
    public int OwnersInGrace { get; set; }
    public int OwnersReleased { get; set; }
    public int TotalOwners { get; set; }
    public int TotalVaultItems { get; set; }
    public long TotalVaultBytes { get; set; }
    public int AuditEvents24h { get; set; }
    public List<StateCountDto> StateBreakdown { get; set; } = new();
}

public class StateCountDto
{
    public LifecycleState State { get; set; }
    public int Count { get; set; }
}

public class GetReleaseQueueInput : PagedAndSortedResultRequestDto
{
    /// <summary>"pending" (mặc định: chờ thẩm định + cần bổ sung + chờ cuối), "consent", "closed", "all".</summary>
    public string? Tab { get; set; }
}

public class ReleaseQueueItemDto
{
    public Guid Id { get; set; }
    public string OwnerName { get; set; } = default!;
    public ReleaseStatus Status { get; set; }
    public ReleaseReason Reason { get; set; }
    public DateTime InitiatedAt { get; set; }
    public DateTime? ReviewRequestedAt { get; set; }
    public DateTime? SlaDueAt { get; set; }
    public bool IsSlaOverdue { get; set; }
    public int EffectiveConsents { get; set; }
    public int RequiredConsents { get; set; }
    public int EvidenceCount { get; set; }
    public RiskSeverity? MaxRisk { get; set; }
    public int RiskFlagCount { get; set; }
    public int ReviewRound { get; set; }
    public int CurrentStage { get; set; }
    public DateTime? FinalWaitUntil { get; set; }
}

/// <summary>
/// Chi tiết hồ sơ mở vault — 5 khối theo thứ tự người duyệt cần đọc:
/// Tóm tắt quyết định → Timeline → Đồng thuận → Bằng chứng → Cờ rủi ro.
/// <para>KHÔNG có trường nào chứa nội dung vault — kể cả khi admin muốn.</para>
/// </summary>
public class ReleaseCaseDto
{
    public Guid Id { get; set; }
    public ReleaseStatus Status { get; set; }
    public ReleaseReason Reason { get; set; }
    public string? Statement { get; set; }
    public DateTime InitiatedAt { get; set; }
    public string InitiatorName { get; set; } = default!;
    public int RequiredConsents { get; set; }
    public int EffectiveConsents { get; set; }
    public int ReviewRound { get; set; }
    public int CurrentStage { get; set; }
    public string? InfoRequestNote { get; set; }
    public DateTime? FinalWaitUntil { get; set; }
    public DateTime? ReleasedAt { get; set; }
    public string? CloseNote { get; set; }
    public DateTime? SlaDueAt { get; set; }

    public DecisionSummaryDto Summary { get; set; } = new();
    public CaseOwnerDto Owner { get; set; } = new();
    public List<TimelineEntryDto> Timeline { get; set; } = new();
    public List<CaseConsentDto> Consents { get; set; } = new();
    public List<CaseTrusteeDto> Trustees { get; set; } = new();
    public List<CaseEvidenceDto> Evidence { get; set; } = new();
    public List<RiskFlagDto> RiskFlags { get; set; } = new();
    public List<ReviewVoteDto> Votes { get; set; } = new();

    // Quyền của người đang xem
    /// <summary>0 = không được bỏ phiếu lúc này; 1/2 = được bỏ phiếu ở giai đoạn đó.</summary>
    public int MyVoteStage { get; set; }
    public string? MyVoteBlockedReason { get; set; }
    public bool CanViewEvidence { get; set; }
}

/// <summary>Khối 1: hệ thống đề xuất gì và vì sao (4 cổng).</summary>
public class DecisionSummaryDto
{
    public string Recommendation { get; set; } = default!;
    public bool AllGatesPassed { get; set; }
    public List<GateDto> Gates { get; set; } = new();
}

public class GateDto
{
    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    public bool Passed { get; set; }
    public string Detail { get; set; } = default!;
}

public class CaseOwnerDto
{
    public string DisplayName { get; set; } = default!;
    public string Email { get; set; } = default!;
    public string? PhoneNumber { get; set; }
    public LifecycleState State { get; set; }
    public DateTime? LastCheckInAt { get; set; }
    public int CheckInIntervalDays { get; set; }
    public int GraceDays { get; set; }
    public DateTime? GraceStartedAt { get; set; }
    public DateTime AccountCreatedAt { get; set; }
    /// <summary>Chỉ metadata: số hạng mục + dung lượng.</summary>
    public int VaultItemCount { get; set; }
    public long VaultSizeBytes { get; set; }
}

public class TimelineEntryDto
{
    public DateTime At { get; set; }
    public string Kind { get; set; } = default!;
    public string Title { get; set; } = default!;
    public string? Detail { get; set; }
}

public class CaseConsentDto
{
    public string TrusteeName { get; set; } = default!;
    public string? Relationship { get; set; }
    public DateTime ConsentedAt { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? Statement { get; set; }
}

public class CaseTrusteeDto
{
    public string DisplayName { get; set; } = default!;
    public string? Relationship { get; set; }
    public TrusteeRole Role { get; set; }
    public TrusteeStatus Status { get; set; }
    public DateTime AddedAt { get; set; }
    public ContactResponse? LastContactResponse { get; set; }
    public DateTime? LastContactResponseAt { get; set; }
}

public class CaseEvidenceDto
{
    public Guid Id { get; set; }
    public EvidenceKind Kind { get; set; }
    public string FileName { get; set; } = default!;
    public string ContentType { get; set; } = default!;
    public long SizeBytes { get; set; }
    public DateTime UploadedAt { get; set; }
    public string UploadedBy { get; set; } = default!;
    public DateTime? PurgedAt { get; set; }
}

public class RiskFlagDto
{
    public string Code { get; set; } = default!;
    public RiskSeverity Severity { get; set; }
    public string Message { get; set; } = default!;
}

public class ReviewVoteDto
{
    public int Round { get; set; }
    public int Stage { get; set; }
    public string AdminName { get; set; } = default!;
    public ReviewDecision Decision { get; set; }
    public string? Note { get; set; }
    public DateTime VotedAt { get; set; }
}

public class CastVoteInput
{
    public ReviewDecision Decision { get; set; }
    [StringLength(2000)] public string? Note { get; set; }
}

public class GetAuditLogInput : PagedResultRequestDto
{
    public Guid? OwnerId { get; set; }
    public string? Action { get; set; }
}

public class ChainVerificationDto
{
    public long TotalEvents { get; set; }
    public bool IsIntact { get; set; }
    public long? FirstBrokenSequence { get; set; }
    public DateTime CheckedAt { get; set; }
}

public class PolicyDto
{
    public int MissedPhaseDays { get; set; }
    public string[] ReminderChannels { get; set; } = [];
    public int DefaultGraceDays { get; set; }
    public int MinGraceDays { get; set; }
    public int MaxGraceDays { get; set; }
    public int FinalWaitHours { get; set; }
    public int ReviewSlaDays { get; set; }
    public int MaxPauseDays { get; set; }
    public int NewTrusteeRiskDays { get; set; }
    public int EvidenceRetentionDays { get; set; }
    public bool EnforceDistinctConsentIp { get; set; }
    public double TimeScale { get; set; }
    public int[] AllowedCheckInIntervals { get; set; } = [];
}

/// <summary>Quyền của admin đang đăng nhập — admin console dùng để ẩn/hiện menu.</summary>
public class AdminProfileDto
{
    public string UserName { get; set; } = default!;
    public string? Name { get; set; }
    public List<string> Roles { get; set; } = new();
    public List<string> GrantedPermissions { get; set; } = new();
    public bool IsSuperAdmin { get; set; }
    /// <summary>Hệ số nén thời gian (demo) — console hiển thị dải cảnh báo khi &gt; 1.</summary>
    public double TimeScale { get; set; }
    public DateTime ServerNow { get; set; }
}
