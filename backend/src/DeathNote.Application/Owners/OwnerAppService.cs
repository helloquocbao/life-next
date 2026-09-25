using DeathNote.AuditTrail;
using DeathNote.Common;
using DeathNote.Lifecycle;
using DeathNote.Releases;
using DeathNote.Security;
using DeathNote.Trustees;
using DeathNote.Vaults;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace DeathNote.Owners;

/// <summary>
/// Use-case của owner. Mọi thao tác đều giới hạn trong hồ sơ của CHÍNH người đang đăng nhập
/// (Id hồ sơ = Id người dùng) — không có tham số nào cho phép chỉ định hồ sơ người khác.
/// </summary>
[Authorize]
public class OwnerAppService : DeathNoteAppService, IOwnerAppService
{
    private const string TotpProvider = "DeathNote";
    private const string TotpActiveKey = "CheckInTotp";
    private const string TotpPendingKey = "CheckInTotpPending";

    private readonly IRepository<OwnerProfile, Guid> _owners;
    private readonly IRepository<Heartbeat, Guid> _heartbeats;
    private readonly IRepository<Vault, Guid> _vaults;
    private readonly IRepository<VaultItem, Guid> _items;
    private readonly IRepository<Trustee, Guid> _trustees;
    private readonly IRepository<ReleaseRequest, Guid> _releases;
    private readonly IRepository<AuditEvent, Guid> _auditEvents;
    private readonly LifecycleManager _lifecycle;
    private readonly LifecyclePolicy _policy;
    private readonly CheckInLinkService _links;
    private readonly IdentityUserManager _userManager;

    public OwnerAppService(
        IRepository<OwnerProfile, Guid> owners,
        IRepository<Heartbeat, Guid> heartbeats,
        IRepository<Vault, Guid> vaults,
        IRepository<VaultItem, Guid> items,
        IRepository<Trustee, Guid> trustees,
        IRepository<ReleaseRequest, Guid> releases,
        IRepository<AuditEvent, Guid> auditEvents,
        LifecycleManager lifecycle,
        LifecyclePolicy policy,
        CheckInLinkService links,
        IdentityUserManager userManager)
    {
        _owners = owners;
        _heartbeats = heartbeats;
        _vaults = vaults;
        _items = items;
        _trustees = trustees;
        _releases = releases;
        _auditEvents = auditEvents;
        _lifecycle = lifecycle;
        _policy = policy;
        _links = links;
        _userManager = userManager;
    }

    // =====================================================================
    //  HOME
    // =====================================================================

    public async Task<OwnerStatusDto> GetStatusAsync()
    {
        var owner = await _owners.FindAsync(UserId);
        if (owner == null)
        {
            return new OwnerStatusDto
            {
                HasProfile = false,
                DisplayName = CurrentUser.Name ?? CurrentUser.UserName,
                Email = CurrentUser.Email,
                ServerNow = Clock.Now,
                TimeScale = _policy.Options.TimeScale
            };
        }
        return await BuildStatusAsync(owner);
    }

    private async Task<OwnerStatusDto> BuildStatusAsync(OwnerProfile owner)
    {
        var vault = await _vaults.FindAsync(owner.Id);
        var itemQuery = (await _items.GetQueryableAsync()).Where(i => i.OwnerId == owner.Id);
        var itemCount = await AsyncExecuter.CountAsync(itemQuery);
        var itemBytes = await AsyncExecuter.SumAsync(itemQuery, i => (long)i.SizeBytes);
        var lastItemUpdate = itemCount == 0 ? (DateTime?)null
            : await AsyncExecuter.MaxAsync(itemQuery, i => i.LastModificationTime ?? i.CreationTime);
        var trustees = await _trustees.GetListAsync(t => t.OwnerId == owner.Id);
        var open = await _releases.FirstOrDefaultAsync(r => r.OwnerId == owner.Id && r.Status != ReleaseStatus.Released
            && r.Status != ReleaseStatus.Rejected && r.Status != ReleaseStatus.CancelledByOwner);

        var dto = new OwnerStatusDto
        {
            HasProfile = true,
            DisplayName = owner.DisplayName,
            Email = owner.Email,
            PhoneNumber = owner.PhoneNumber,
            State = owner.State,
            StateChangedAt = owner.StateChangedAt,
            LastCheckInAt = owner.LastCheckInAt,
            NextCheckInDueAt = owner.NextCheckInDueAt,
            CheckInIntervalDays = owner.CheckInIntervalDays,
            GraceDays = owner.GraceDays,
            RemindersSent = owner.RemindersSent,
            ReminderSteps = _policy.ReminderSteps,
            GraceEndsAt = owner.GraceEndsAt(_policy),
            PausedUntil = owner.IsPaused(Clock.Now) ? owner.PausedUntil : null,
            PauseReason = owner.IsPaused(Clock.Now) ? owner.PauseReason : null,
            VaultInitialized = vault != null,
            ItemCount = itemCount,
            VaultSizeBytes = itemBytes,
            LastVaultUpdateAt = lastItemUpdate,
            TrusteeCount = trustees.Count,
            ConfirmedTrusteeCount = trustees.Count(t => t.Status == TrusteeStatus.Confirmed),
            Threshold = vault?.Threshold,
            KeyHolderCount = vault?.KeyHolderCount,
            KeysDistributed = vault?.HasKeyDistribution ?? false,
            KeysOutdated = vault?.KeysOutdated ?? false,
            RecoveryKitConfirmed = owner.RecoveryKitConfirmed,
            CheckInTwoFactorEnabled = owner.CheckInTwoFactorEnabled,
            ServerNow = Clock.Now,
            TimeScale = _policy.Options.TimeScale
        };

        // Khi đang Missed: dự kiến mốc người thân được báo = lần nhắc cuối + 1 khoảng nhắc.
        if (owner.State == LifecycleState.Missed)
        {
            var remaining = _policy.ReminderSteps - owner.RemindersSent;
            var from = owner.LastReminderAt ?? Clock.Now;
            dto.TrusteesNotifiedAt = from + TimeSpan.FromTicks(_policy.ReminderInterval.Ticks * (remaining + 1));
        }

        if (open != null)
        {
            var initiator = trustees.FirstOrDefault(t => t.Id == open.InitiatorTrusteeId);
            var detailed = await _releases.GetWithDetailsAsync(open.Id, AsyncExecuter);
            dto.OpenRelease = new OpenReleaseSummaryDto
            {
                Id = open.Id,
                Status = open.Status,
                Reason = open.Reason,
                InitiatorName = initiator?.DisplayName ?? "?",
                InitiatedAt = open.InitiatedAt,
                EffectiveConsents = detailed.EffectiveConsentCount(_policy.Options.EnforceDistinctConsentIp),
                RequiredConsents = open.RequiredConsents,
                FinalWaitUntil = open.FinalWaitUntil
            };
        }

        dto.Readiness = BuildReadiness(dto, trustees);
        return dto;
    }

    /// <summary>
    /// Điểm sẵn sàng (0–100) + một việc nên làm tiếp. Server chỉ chấm được những gì nó biết
    /// (không đọc được nội dung vault); client bổ sung gợi ý theo loại hạng mục sau khi giải mã.
    /// </summary>
    private static ReadinessDto BuildReadiness(OwnerStatusDto s, List<Trustee> trustees)
    {
        var readyKeyHolders = trustees.Count(t => t.Role == TrusteeRole.KeyHolder && t.IsReadyForKeys);
        var checks = new List<ReadinessCheckDto>
        {
            new() { Code = "vault", Label = "Tạo két dữ liệu mã hoá", Done = s.VaultInitialized, Weight = 15 },
            new() { Code = "recovery_kit", Label = "Cất giữ 12 từ khôi phục", Done = s.RecoveryKitConfirmed, Weight = 15 },
            new() { Code = "first_item", Label = "Thêm hạng mục đầu tiên", Done = s.ItemCount >= 1, Weight = 15 },
            new() { Code = "five_items", Label = "Có ít nhất 5 hạng mục", Done = s.ItemCount >= 5, Weight = 10 },
            new() { Code = "trustee", Label = "Có người được uỷ quyền đã xác nhận", Done = s.ConfirmedTrusteeCount >= 1, Weight = 15 },
            new() { Code = "two_keyholders", Label = "Có ít nhất 2 người giữ khoá", Done = readyKeyHolders >= 2, Weight = 10 },
            new() { Code = "keys", Label = "Phân mảnh khoá và phân bổ người nhận", Done = s.KeysDistributed && !s.KeysOutdated, Weight = 15 },
            new() { Code = "two_factor", Label = "Bật xác thực hai lớp cho check-in", Done = s.CheckInTwoFactorEnabled, Weight = 5 },
        };
        return new ReadinessDto
        {
            Checks = checks,
            Score = checks.Where(c => c.Done).Sum(c => c.Weight),
            NextActionCode = checks.FirstOrDefault(c => !c.Done)?.Code
        };
    }

    // =====================================================================
    //  ONBOARDING + CẤU HÌNH
    // =====================================================================

    public async Task<OwnerStatusDto> CompleteOnboardingAsync(CompleteOnboardingInput input)
    {
        var owner = await _owners.FindAsync(UserId);
        if (owner == null)
        {
            owner = new OwnerProfile(UserId, input.DisplayName, CurrentUser.Email ?? $"{CurrentUser.UserName}@unknown",
                input.PhoneNumber, input.CheckInIntervalDays, input.GraceDays, Clock.Now, _policy);
            await _owners.InsertAsync(owner, autoSave: true);
            await Audit.RecordAsync(new AuditEntry(AuditActions.OnboardingCompleted, owner.Id, ActorType: AuditActorType.Owner,
                ActorUserId: owner.Id, ActorName: owner.DisplayName,
                Detail: $"Nhịp {input.CheckInIntervalDays} ngày, ân hạn {input.GraceDays} ngày"));
        }
        else
        {
            owner.UpdateContact(input.DisplayName, owner.Email, input.PhoneNumber, Clock.Now);
            owner.UpdateSchedule(input.CheckInIntervalDays, input.GraceDays, _policy);
            await _owners.UpdateAsync(owner, autoSave: true);
        }
        return await BuildStatusAsync(owner);
    }

    public async Task UpdateScheduleAsync(UpdateScheduleInput input)
    {
        var owner = await GetOwnerAsync();
        owner.UpdateSchedule(input.CheckInIntervalDays, input.GraceDays, _policy);
        await _owners.UpdateAsync(owner);
        await Audit.RecordAsync(new AuditEntry(AuditActions.ScheduleChanged, owner.Id, ActorType: AuditActorType.Owner,
            ActorUserId: owner.Id, ActorName: owner.DisplayName, Detail: $"Nhịp {input.CheckInIntervalDays} ngày, ân hạn {input.GraceDays} ngày"));
    }

    public async Task UpdateContactAsync(UpdateContactInput input)
    {
        var owner = await GetOwnerAsync();
        owner.UpdateContact(input.DisplayName, owner.Email, input.PhoneNumber, Clock.Now);
        await _owners.UpdateAsync(owner);
    }

    public async Task PauseAsync(PauseInput input)
    {
        var owner = await GetOwnerAsync();
        owner.Pause(DateTime.SpecifyKind(input.Until, DateTimeKind.Utc), input.Reason, Clock.Now, _policy);
        await _owners.UpdateAsync(owner);
        await Audit.RecordAsync(new AuditEntry(AuditActions.Paused, owner.Id, ActorType: AuditActorType.Owner,
            ActorUserId: owner.Id, ActorName: owner.DisplayName, Detail: $"Tạm dừng tới {input.Until:O}: {input.Reason}"));
    }

    public async Task ResumeAsync()
    {
        var owner = await GetOwnerAsync();
        owner.Resume();
        await _owners.UpdateAsync(owner);
        await Audit.RecordAsync(new AuditEntry(AuditActions.Resumed, owner.Id, ActorType: AuditActorType.Owner,
            ActorUserId: owner.Id, ActorName: owner.DisplayName));
    }

    public async Task ConfirmRecoveryKitAsync()
    {
        var owner = await GetOwnerAsync();
        owner.ConfirmRecoveryKit();
        await _owners.UpdateAsync(owner);
    }

    // =====================================================================
    //  CHECK-IN
    // =====================================================================

    public async Task<CheckInResultDto> CheckInAsync(CheckInInput input)
    {
        var owner = await GetOwnerAsync();
        if (owner.CheckInTwoFactorEnabled)
        {
            if (string.IsNullOrWhiteSpace(input.TwoFactorCode)) throw new BusinessException(DeathNoteErrorCodes.TwoFactorRequired);
            var secret = await GetTotpSecretAsync(TotpActiveKey);
            if (secret == null || !Totp.Verify(secret, input.TwoFactorCode, DateTime.UtcNow))
                throw new BusinessException(DeathNoteErrorCodes.InvalidTwoFactorCode);
        }

        var previous = await _lifecycle.CheckInAsync(owner, CheckInChannel.Web);
        return new CheckInResultDto
        {
            PreviousState = previous,
            WasVeto = previous != LifecycleState.Active,
            NextCheckInDueAt = owner.NextCheckInDueAt
        };
    }

    [AllowAnonymous]
    public async Task<CheckInByLinkResultDto> CheckInByLinkAsync(CheckInByLinkInput input)
    {
        var parsed = _links.Validate(input.Token) ?? throw new BusinessException(DeathNoteErrorCodes.InvalidCheckInLink);
        var owner = await _owners.FindAsync(parsed.OwnerId);
        if (owner == null || owner.CheckInLinkNonce != parsed.Nonce)
            throw new BusinessException(DeathNoteErrorCodes.InvalidCheckInLink);

        var previous = await _lifecycle.CheckInAsync(owner, CheckInChannel.EmailLink);
        return new CheckInByLinkResultDto
        {
            DisplayName = owner.DisplayName,
            WasVeto = previous != LifecycleState.Active,
            NextCheckInDueAt = owner.NextCheckInDueAt
        };
    }

    public async Task<List<HeartbeatDto>> GetHeartbeatsAsync()
    {
        var query = (await _heartbeats.GetQueryableAsync())
            .Where(h => h.OwnerId == UserId).OrderByDescending(h => h.OccurredAt).Take(100);
        return (await AsyncExecuter.ToListAsync(query)).Select(h => new HeartbeatDto
        {
            OccurredAt = h.OccurredAt,
            Channel = h.Channel,
            IpAddress = h.IpAddress,
            WasVeto = h.WasVeto
        }).ToList();
    }

    /// <summary>Nhật ký hoạt động: owner xem được TOÀN BỘ log liên quan đến hồ sơ của mình.</summary>
    public async Task<PagedResultDto<AuditEventDto>> GetActivityAsync(GetActivityInput input)
    {
        var query = (await _auditEvents.GetQueryableAsync()).Where(e => e.OwnerId == UserId);
        var total = await AsyncExecuter.LongCountAsync(query);
        var page = await AsyncExecuter.ToListAsync(query.OrderByDescending(e => e.Sequence).Skip(input.SkipCount).Take(input.MaxResultCount));
        return new PagedResultDto<AuditEventDto>(total, page.Select(e => e.ToDto()).ToList());
    }

    // =====================================================================
    //  DIỄN TẬP
    // =====================================================================

    /// <summary>
    /// Diễn tập toàn bộ quy trình ở chế độ mô phỏng: KHÔNG gửi thông báo cho ai, không đổi trạng thái.
    /// Phần "mỗi người thân sẽ nhận được gì" được client tự giải mã và hiển thị (server không đọc được).
    /// </summary>
    public async Task<DryRunDto> GetDryRunAsync()
    {
        var owner = await GetOwnerAsync();
        var vault = await _vaults.FindAsync(owner.Id);
        var trustees = await _trustees.GetListAsync(t => t.OwnerId == owner.Id);
        var o = _policy.Options;
        var m = vault?.Threshold ?? 2;
        var n = vault?.KeyHolderCount ?? trustees.Count(t => t.Role == TrusteeRole.KeyHolder);

        var steps = new List<DryRunStepDto>
        {
            new() { State = LifecycleState.Active, Title = "Bạn im lặng", DurationDays = owner.CheckInIntervalDays, OwnerCanCancel = true,
                Description = $"Không check-in trong {owner.CheckInIntervalDays} ngày." },
            new() { State = LifecycleState.Missed, Title = "Nhắc nhở leo thang", DurationDays = o.MissedPhaseDays, OwnerCanCancel = true,
                Description = $"Hệ thống nhắc {o.ReminderChannels.Length} vòng qua: {string.Join(" → ", o.ReminderChannels)}. Mỗi tin có link check-in một chạm." },
            new() { State = LifecycleState.Grace, Title = "Báo người thân", DurationDays = owner.GraceDays, OwnerCanCancel = true,
                Description = $"{trustees.Count(t => t.Status == TrusteeStatus.Confirmed)} người được uỷ quyền nhận tin \"hãy liên lạc với {owner.DisplayName}\". Chưa ai xem được dữ liệu." },
            new() { State = LifecycleState.Verifying, Title = "Người thân yêu cầu mở", DurationDays = 0, OwnerCanCancel = true,
                Description = $"Cần {m}/{n} người giữ khoá đồng ý và nộp bằng chứng. Bạn nhận cảnh báo qua mọi kênh." },
            new() { State = LifecycleState.Review, Title = "PICO thẩm định", DurationDays = o.ReviewSlaDays, OwnerCanCancel = true,
                Description = "Hai thẩm định viên độc lập kiểm tra bằng chứng, đồng thuận và cờ rủi ro." },
            new() { State = LifecycleState.FinalWait, Title = "Chờ cuối", DurationDays = o.FinalWaitHours / 24.0, OwnerCanCancel = true,
                Description = $"Chờ thêm {o.FinalWaitHours} giờ, cảnh báo cuối qua mọi kênh. Đây là chốt chặn cuối cùng." },
            new() { State = LifecycleState.Released, Title = "Bàn giao", DurationDays = 0, OwnerCanCancel = false,
                Description = "Mỗi người nhận tự ghép khoá trên thiết bị và chỉ mở được phần bạn đã phân cho họ." },
        };

        var blockers = new List<string>();
        if (vault == null) blockers.Add("Chưa tạo két dữ liệu.");
        if (!trustees.Any(t => t.Role == TrusteeRole.KeyHolder && t.IsReadyForKeys)) blockers.Add("Chưa có người giữ khoá nào xác nhận lời mời.");
        if (vault is { HasKeyDistribution: false }) blockers.Add("Chưa phân mảnh khoá cho người thân.");
        if (vault is { KeysOutdated: true }) blockers.Add("Danh sách người nhận đã thay đổi — cần phân mảnh lại khoá.");

        return new DryRunDto
        {
            Steps = steps,
            TotalDays = steps.Sum(s => s.DurationDays),
            IsReady = blockers.Count == 0,
            Blockers = blockers
        };
    }

    // =====================================================================
    //  XÁC THỰC HAI LỚP CHO CHECK-IN
    // =====================================================================

    public async Task<TwoFactorSetupDto> GetTwoFactorSetupAsync()
    {
        var user = await _userManager.GetByIdAsync(UserId);
        var secret = await _userManager.GetAuthenticationTokenAsync(user, TotpProvider, TotpPendingKey);
        if (secret == null)
        {
            secret = Totp.GenerateSecret();
            (await _userManager.SetAuthenticationTokenAsync(user, TotpProvider, TotpPendingKey, secret)).CheckErrors();
        }
        return new TwoFactorSetupDto
        {
            SharedKey = secret,
            AuthenticatorUri = Totp.BuildUri("LifeNext", user.Email ?? user.UserName, secret)
        };
    }

    public async Task EnableTwoFactorAsync(EnableTwoFactorInput input)
    {
        var owner = await GetOwnerAsync();
        var user = await _userManager.GetByIdAsync(UserId);
        var pending = await _userManager.GetAuthenticationTokenAsync(user, TotpProvider, TotpPendingKey);
        if (pending == null || !Totp.Verify(pending, input.Code, DateTime.UtcNow))
            throw new BusinessException(DeathNoteErrorCodes.InvalidTwoFactorCode);

        (await _userManager.SetAuthenticationTokenAsync(user, TotpProvider, TotpActiveKey, pending)).CheckErrors();
        (await _userManager.RemoveAuthenticationTokenAsync(user, TotpProvider, TotpPendingKey)).CheckErrors();
        owner.SetCheckInTwoFactor(true);
        await _owners.UpdateAsync(owner);
        await Audit.RecordAsync(new AuditEntry(AuditActions.TwoFactorEnabled, owner.Id, ActorType: AuditActorType.Owner,
            ActorUserId: owner.Id, ActorName: owner.DisplayName));
    }

    public async Task DisableTwoFactorAsync(EnableTwoFactorInput input)
    {
        var owner = await GetOwnerAsync();
        var secret = await GetTotpSecretAsync(TotpActiveKey);
        if (secret == null || !Totp.Verify(secret, input.Code, DateTime.UtcNow))
            throw new BusinessException(DeathNoteErrorCodes.InvalidTwoFactorCode);
        var user = await _userManager.GetByIdAsync(UserId);
        (await _userManager.RemoveAuthenticationTokenAsync(user, TotpProvider, TotpActiveKey)).CheckErrors();
        owner.SetCheckInTwoFactor(false);
        await _owners.UpdateAsync(owner);
    }

    private async Task<string?> GetTotpSecretAsync(string name)
    {
        var user = await _userManager.GetByIdAsync(UserId);
        return await _userManager.GetAuthenticationTokenAsync(user, TotpProvider, name);
    }

    private async Task<OwnerProfile> GetOwnerAsync() =>
        await _owners.FindAsync(UserId) ?? throw new BusinessException(DeathNoteErrorCodes.OnboardingRequired);
}
