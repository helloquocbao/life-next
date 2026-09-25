using DeathNote.AuditTrail;
using DeathNote.Lifecycle;
using DeathNote.Owners;
using DeathNote.Permissions;
using DeathNote.Releases;
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
        DeathNotePermissions.Releases.Default,
        DeathNotePermissions.Releases.Evidence,
        DeathNotePermissions.Releases.Review,
        DeathNotePermissions.Releases.Approve,
        DeathNotePermissions.AuditLog,
        DeathNotePermissions.Policy.Default,
        DeathNotePermissions.Policy.Manage
    ];

    private readonly IRepository<OwnerProfile, Guid> _owners;
    private readonly IRepository<ReleaseRequest, Guid> _releases;
    private readonly IRepository<VaultItem, Guid> _items;
    private readonly IRepository<AuditEvent, Guid> _auditEvents;
    private readonly LifecyclePolicy _policy;

    public AdminDashboardAppService(IRepository<OwnerProfile, Guid> owners, IRepository<ReleaseRequest, Guid> releases,
        IRepository<VaultItem, Guid> items, IRepository<AuditEvent, Guid> auditEvents, LifecyclePolicy policy)
    {
        _owners = owners;
        _releases = releases;
        _items = items;
        _auditEvents = auditEvents;
        _policy = policy;
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
        var sla = _policy.Days(_policy.Options.ReviewSlaDays);
        var owners = await _owners.GetQueryableAsync();
        var releases = await _releases.GetQueryableAsync();
        var items = await _items.GetQueryableAsync();

        var stateCounts = await AsyncExecuter.ToListAsync(owners.GroupBy(o => o.State).Select(g => new { g.Key, Count = g.Count() }));
        int C(LifecycleState s) => stateCounts.FirstOrDefault(x => x.Key == s)?.Count ?? 0;

        var reviewing = releases.Where(r => r.Status == ReleaseStatus.AwaitingFirstReview || r.Status == ReleaseStatus.AwaitingSecondReview);
        var reviewTimes = await AsyncExecuter.ToListAsync(reviewing.Select(r => r.ReviewRequestedAt));
        var since = now.AddHours(-24);

        return new AdminDashboardDto
        {
            PendingReviews = reviewTimes.Count,
            SlaOverdue = reviewTimes.Count(t => t.HasValue && t.Value + sla < now),
            NeedsMoreInfo = await AsyncExecuter.CountAsync(releases.Where(r => r.Status == ReleaseStatus.NeedsMoreInfo)),
            InFinalWait = await AsyncExecuter.CountAsync(releases.Where(r => r.Status == ReleaseStatus.FinalWait)),
            AwaitingConsent = await AsyncExecuter.CountAsync(releases.Where(r => r.Status == ReleaseStatus.AwaitingConsent)),
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
    public Task<PolicyDto> GetPolicyAsync()
    {
        var o = _policy.Options;
        return Task.FromResult(new PolicyDto
        {
            MissedPhaseDays = o.MissedPhaseDays,
            ReminderChannels = o.ReminderChannels,
            DefaultGraceDays = o.DefaultGraceDays,
            MinGraceDays = o.MinGraceDays,
            MaxGraceDays = o.MaxGraceDays,
            FinalWaitHours = o.FinalWaitHours,
            ReviewSlaDays = o.ReviewSlaDays,
            MaxPauseDays = o.MaxPauseDays,
            NewTrusteeRiskDays = o.NewTrusteeRiskDays,
            EvidenceRetentionDays = o.EvidenceRetentionDays,
            EnforceDistinctConsentIp = o.EnforceDistinctConsentIp,
            TimeScale = o.TimeScale,
            AllowedCheckInIntervals = DeathNoteConsts.AllowedCheckInIntervals
        });
    }
}
