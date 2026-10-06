using DeathNote.AuditTrail;
using DeathNote.Lifecycle;
using DeathNote.Owners;
using DeathNote.Permissions;
using DeathNote.Vaults;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Authorization.Permissions;
using Volo.Abp.Domain.Repositories;

namespace DeathNote.Admin;

/// <summary>Dashboard vận hành — chỉ số liệu tổng hợp, không danh tính khách hàng.</summary>
[Authorize]
public class AdminDashboardAppService : DeathNoteAppService, IAdminDashboardAppService
{
    private static readonly string[] AllPermissions =
    [
        DeathNotePermissions.Dashboard,
        DeathNotePermissions.Customers.Default,
        DeathNotePermissions.Customers.ViewContact,
        DeathNotePermissions.Staff.Default,
        DeathNotePermissions.Staff.Create,
        DeathNotePermissions.Staff.Update,
        DeathNotePermissions.Staff.Lock,
        DeathNotePermissions.Staff.ResetPassword,
        DeathNotePermissions.Roles.Default,
        DeathNotePermissions.Roles.Create,
        DeathNotePermissions.Roles.Update,
        DeathNotePermissions.Roles.Delete,
        DeathNotePermissions.AuditLog,
        DeathNotePermissions.Policy.Default,
        DeathNotePermissions.Policy.Manage,
        DeathNotePermissions.EmailTemplates.Default,
        DeathNotePermissions.EmailTemplates.Manage
    ];

    private readonly IRepository<OwnerProfile, Guid> _owners;
    private readonly IRepository<VaultItem, Guid> _items;
    private readonly IRepository<AuditEvent, Guid> _auditEvents;
    private readonly LifecyclePolicy _policy;
    private readonly LifecyclePolicyStore _policyStore;

    public AdminDashboardAppService(IRepository<OwnerProfile, Guid> owners, IRepository<VaultItem, Guid> items,
        IRepository<AuditEvent, Guid> auditEvents, LifecyclePolicy policy, LifecyclePolicyStore policyStore)
    {
        _owners = owners;
        _items = items;
        _auditEvents = auditEvents;
        _policy = policy;
        _policyStore = policyStore;
    }

    /// <summary>Thông tin + quyền của admin đang đăng nhập (dùng để dựng menu). Ai đăng nhập cũng gọi được.</summary>
    public async Task<AdminProfileDto> GetProfileAsync()
    {
        var granted = await LazyServiceProvider.LazyGetRequiredService<IPermissionChecker>().IsGrantedAsync(AllPermissions);
        return new AdminProfileDto
        {
            UserName = CurrentUser.UserName ?? "",
            Name = CurrentUser.Name,
            Roles = CurrentUser.Roles.ToList(),
            GrantedPermissions = granted.Result.Where(r => r.Value == PermissionGrantResult.Granted).Select(r => r.Key).ToList(),
            IsSuperAdmin = CurrentUser.IsInRole(DeathNoteConsts.Roles.SuperAdmin),
            TimeScale = _policy.Options.TimeScale,
            ServerNow = Clock.Now
        };
    }

    [Authorize(DeathNotePermissions.Dashboard)]
    public async Task<AdminDashboardDto> GetAsync()
    {
        var now = Clock.Now;
        var owners = await _owners.GetQueryableAsync();
        var items = await _items.GetQueryableAsync();

        var stateCounts = await AsyncExecuter.ToListAsync(owners.GroupBy(o => o.State).Select(g => new { g.Key, Count = g.Count() }));
        int C(LifecycleState s) => stateCounts.FirstOrDefault(x => x.Key == s)?.Count ?? 0;

        var since = now.AddHours(-24);

        return new AdminDashboardDto
        {
            OwnersActive = C(LifecycleState.Active),
            OwnersMissed = C(LifecycleState.Missed),
            OwnersInGrace = C(LifecycleState.Grace),
            OwnersReleased = C(LifecycleState.Released),
            TotalOwners = stateCounts.Sum(x => x.Count),
            TotalVaultItems = await AsyncExecuter.CountAsync(items),
            TotalVaultBytes = await AsyncExecuter.SumAsync(items, i => (long)i.SizeBytes),
            AuditEvents24h = await AsyncExecuter.CountAsync((await _auditEvents.GetQueryableAsync()).Where(e => e.OccurredAt >= since)),
            StateBreakdown = Enum.GetValues<LifecycleState>().Select(s => new StateCountDto { State = s, Count = C(s) }).ToList()
        };
    }

    [Authorize(DeathNotePermissions.Policy.Default)]
    public Task<PolicyDto> GetPolicyAsync() => Task.FromResult(ToPolicyDto());

    /// <summary>Chỉnh chính sách — lưu CSDL, có hiệu lực ngay, ghi audit (giá trị cũ → mới).</summary>
    [Authorize(DeathNotePermissions.Policy.Manage)]
    public async Task<PolicyDto> UpdatePolicyAsync(UpdatePolicyInput input)
    {
        var before = _policy.Snapshot();
        var after = new EditablePolicy(input.MissedPhaseDays, input.ReminderChannels.Distinct().ToArray(), input.DefaultGraceDays,
            input.MinGraceDays, input.MaxGraceDays, input.MaxPauseDays);
        await _policyStore.SaveAsync(after);

        await Audit.RecordAsync(new AuditEntry(AuditActions.PolicyUpdated, ActorType: AuditActorType.Admin, ActorUserId: UserId,
            ActorName: CurrentUserDisplayName, Detail: $"{Describe(before)} → {Describe(after)}"));
        return ToPolicyDto();
    }

    private static string Describe(EditablePolicy p) =>
        $"Missed {p.MissedPhaseDays}n, kênh [{string.Join(",", p.ReminderChannels)}], ân hạn {p.MinGraceDays}–{p.DefaultGraceDays}–{p.MaxGraceDays}n, tạm dừng {p.MaxPauseDays}n";

    private PolicyDto ToPolicyDto()
    {
        var o = _policy.Options;
        return new PolicyDto
        {
            MissedPhaseDays = o.MissedPhaseDays,
            ReminderChannels = o.ReminderChannels,
            DefaultGraceDays = o.DefaultGraceDays,
            MinGraceDays = o.MinGraceDays,
            MaxGraceDays = o.MaxGraceDays,
            MaxPauseDays = o.MaxPauseDays,
            TimeScale = o.TimeScale,
            AllowedCheckInIntervals = DeathNoteConsts.AllowedCheckInIntervals,
            AvailableReminderChannels = LifecyclePolicyOptions.AvailableReminderChannels
        };
    }
}
