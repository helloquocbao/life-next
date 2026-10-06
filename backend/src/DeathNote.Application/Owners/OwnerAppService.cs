using DeathNote.AuditTrail;
using DeathNote.Common;
using DeathNote.Lifecycle;
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
            KeysDistributed = vault?.HasKeyDistribution ?? false,
            KeysOutdated = vault?.KeysOutdated ?? false,
            RecoveryKitConfirmed = owner.RecoveryKitConfirmed,
            VaultUnlockTwoFactorEnabled = owner.VaultUnlockTwoFactorEnabled,
            StaffContactOnMissed = owner.StaffContactOnMissed,
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

        dto.Readiness = BuildReadiness(dto, trustees);
        return dto;
    }

    /// <summary>
    /// Điểm sẵn sàng (0–100) + một việc nên làm tiếp. Server chỉ chấm được những gì nó biết
    /// (không đọc được nội dung vault); client bổ sung gợi ý theo loại hạng mục sau khi giải mã.
    /// </summary>
    private static ReadinessDto BuildReadiness(OwnerStatusDto s, List<Trustee> trustees)
    {
        var hasReminder = trustees.Any(t => t.Role == TrusteeRole.Reminder);
        var hasRecipient = trustees.Any(t => t.Role == TrusteeRole.Recipient);
        var checks = new List<ReadinessCheckDto>
        {
            new() { Code = "vault", Label = "Tạo két dữ liệu mã hoá", Done = s.VaultInitialized, Weight = 15 },
            new() { Code = "recovery_kit", Label = "Cất giữ 12 từ khôi phục", Done = s.RecoveryKitConfirmed, Weight = 15 },
            new() { Code = "first_item", Label = "Thêm hạng mục đầu tiên", Done = s.ItemCount >= 1, Weight = 15 },
            new() { Code = "five_items", Label = "Có ít nhất 5 hạng mục", Done = s.ItemCount >= 5, Weight = 10 },
            new() { Code = "reminder", Label = "Có người nhắc nhở khi bạn không xác nhận", Done = hasReminder, Weight = 10 },
            new() { Code = "recipient", Label = "Có người nhận thông tin", Done = hasRecipient, Weight = 15 },
            new() { Code = "keys", Label = "Chọn thông tin cho từng người nhận", Done = s.KeysDistributed && !s.KeysOutdated, Weight = 15 },
            new() { Code = "two_factor", Label = "Bật xác thực hai lớp cho mở két", Done = s.VaultUnlockTwoFactorEnabled, Weight = 5 },
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

    /// <summary>Bật/tắt tuỳ chọn trả phí định kỳ "nhân viên PICO chủ động liên hệ khi đến hạn". MVP: chỉ lưu cờ.</summary>
    public async Task SetStaffContactOnMissedAsync(SetStaffContactOnMissedInput input)
    {
        var owner = await GetOwnerAsync();
        owner.SetStaffContactOnMissed(input.Enabled);
        await _owners.UpdateAsync(owner);
        await Audit.RecordAsync(new AuditEntry(AuditActions.StaffContactPreferenceChanged, owner.Id, ActorType: AuditActorType.Owner,
            ActorUserId: owner.Id, ActorName: owner.DisplayName, Detail: input.Enabled ? "Bật nhân viên liên hệ khi đến hạn (trả phí định kỳ)" : "Tắt nhân viên liên hệ khi đến hạn"));
    }

    // =====================================================================
    //  CHECK-IN
    // =====================================================================

    public async Task<CheckInResultDto> CheckInAsync(CheckInInput input)
    {
        // Không yêu cầu 2FA ở đây: 2FA chỉ áp dụng ở bước mở két (xem VerifyVaultUnlockCodeAsync).
        // Check-in cần nhanh, một chạm — kể cả qua link email/SMS không đăng nhập được.
        var owner = await GetOwnerAsync();
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
        var reminders = trustees.Count(t => t.Role == TrusteeRole.Reminder);
        var recipients = trustees.Where(t => t.Role == TrusteeRole.Recipient).ToList();

        var steps = new List<DryRunStepDto>
        {
            new() { State = LifecycleState.Active, Title = "Bạn im lặng", DurationDays = owner.CheckInIntervalDays, OwnerCanCancel = true,
                Description = $"Không check-in trong {owner.CheckInIntervalDays} ngày." },
            new() { State = LifecycleState.Missed, Title = "Nhắc nhở bạn", DurationDays = o.MissedPhaseDays, OwnerCanCancel = true,
                Description = $"Hệ thống nhắc {o.ReminderChannels.Length} vòng qua: {string.Join(" → ", o.ReminderChannels)}. Mỗi tin có link check-in một chạm. Chưa ai khác biết gì." },
            new() { State = LifecycleState.Grace, Title = "Báo người nhắc nhở", DurationDays = owner.GraceDays, OwnerCanCancel = true,
                Description = $"{reminders} người nhắc nhở nhận tin \"hãy liên lạc với {owner.DisplayName}, nhắc họ bấm Tôi vẫn ổn\". Họ không xem được dữ liệu nào. Bạn vẫn huỷ được bằng một lần bấm." },
            new() { State = LifecycleState.Released, Title = "Tự động bàn giao", DurationDays = 0, OwnerCanCancel = false,
                Description = $"Hết {owner.GraceDays} ngày mà bạn vẫn không xác nhận, {recipients.Count} người nhận thông tin nhận email kèm link để xem phần bạn đã chọn cho họ. Mỗi người chỉ xem được đúng phần của mình." },
        };

        var blockers = new List<string>();
        if (vault == null) blockers.Add("Chưa tạo két dữ liệu.");
        if (reminders == 0) blockers.Add("Chưa có người nhắc nhở — sẽ không ai được báo khi bạn im lặng.");
        if (recipients.Count == 0) blockers.Add("Chưa có người nhận thông tin nào.");
        if (vault is { HasKeyDistribution: false }) blockers.Add("Chưa chọn thông tin cho người nhận.");
        if (vault is { KeysOutdated: true }) blockers.Add("Danh sách người nhận đã thay đổi — cần lưu lại lựa chọn thông tin.");

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
            AuthenticatorUri = Totp.BuildUri("Death Note", user.Email ?? user.UserName, secret)
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
        owner.SetVaultUnlockTwoFactor(true);
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
        owner.SetVaultUnlockTwoFactor(false);
        await _owners.UpdateAsync(owner);
    }

    /// <summary>
    /// Tắt 2FA KHÔNG cần mã 6 số — dùng khi owner mất thiết bị xác thực (điện thoại cài Authenticator).
    /// Lối thoát duy nhất là bằng chứng đã dùng để đăng nhập bộ 12 từ khôi phục: owner chỉ gọi được API
    /// này SAU KHI trình duyệt đã tự giải mã thành công RecoveryWrappedKey bằng 12 từ (xem
    /// RecoveryTwoFactorModal.tsx) — 12 từ không bao giờ gửi lên server, server không xác minh lại được,
    /// nên endpoint này tin vào việc trình duyệt đã tự chặn trước đó (cùng mô hình tin cậy với
    /// change-passphrase: sai 12 từ thì bước giải mã ở trình duyệt đã throw từ trước, không bao giờ gọi
    /// tới đây). Luôn ghi audit riêng để owner tự phát hiện nếu việc này xảy ra ngoài ý muốn.
    /// </summary>
    public async Task DisableTwoFactorViaRecoveryAsync()
    {
        var owner = await GetOwnerAsync();
        if (!owner.VaultUnlockTwoFactorEnabled) return;
        var user = await _userManager.GetByIdAsync(UserId);
        (await _userManager.RemoveAuthenticationTokenAsync(user, TotpProvider, TotpActiveKey)).CheckErrors();
        owner.SetVaultUnlockTwoFactor(false);
        await _owners.UpdateAsync(owner);
        await Audit.RecordAsync(new AuditEntry(AuditActions.TwoFactorDisabledViaRecovery, owner.Id, ActorType: AuditActorType.Owner,
            ActorUserId: owner.Id, ActorName: owner.DisplayName,
            Detail: "Tắt 2FA bằng bộ 12 từ khôi phục (mất thiết bị xác thực)."));
    }

    /// <summary>
    /// Xác thực mã 2FA ở đúng bước mở két: passphrase đã giải mã VaultKey xong TRÊN TRÌNH DUYỆT (không
    /// qua server), owner còn phải nhập thêm mã 6 số này thì UI mới thực sự hiển thị nội dung đã giải mã.
    /// Không có tác dụng phụ (không đổi trạng thái) — chỉ trả về đúng/sai để frontend quyết định mở khoá UI.
    /// </summary>
    public async Task<bool> VerifyVaultUnlockCodeAsync(EnableTwoFactorInput input)
    {
        var owner = await GetOwnerAsync();
        if (!owner.VaultUnlockTwoFactorEnabled) return true; // chưa bật 2FA thì không cần kiểm tra
        var secret = await GetTotpSecretAsync(TotpActiveKey);
        return secret != null && Totp.Verify(secret, input.Code, DateTime.UtcNow);
    }

    private async Task<string?> GetTotpSecretAsync(string name)
    {
        var user = await _userManager.GetByIdAsync(UserId);
        return await _userManager.GetAuthenticationTokenAsync(user, TotpProvider, name);
    }

    private async Task<OwnerProfile> GetOwnerAsync() =>
        await _owners.FindAsync(UserId) ?? throw new BusinessException(DeathNoteErrorCodes.OnboardingRequired);
}
