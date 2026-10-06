using DeathNote.Owners;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Volo.Abp.BackgroundWorkers;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Linq;
using Volo.Abp.Threading;
using Volo.Abp.Timing;
using Volo.Abp.Uow;

namespace DeathNote.Lifecycle;

/// <summary>
/// "Nhịp tim" của hệ thống — chạy định kỳ (mặc định 60 giây) và:
/// chuyển hồ sơ quá hạn check-in sang Missed, gửi từng vòng nhắc, chuyển Missed → Grace (báo người nhắc nhở),
/// hết ân hạn thì Grace → Released (tự động bàn giao cho người nhận).
/// Mỗi hồ sơ được xử lý trong một unit-of-work riêng: lỗi ở một hồ sơ không ảnh hưởng hồ sơ khác.
/// <para>
/// Ghi chú mở rộng: khi chạy nhiều instance, chuyển sang Hangfire/Quartz với distributed lock
/// để tránh xử lý trùng.
/// </para>
/// </summary>
public class LifecycleWorker : AsyncPeriodicBackgroundWorkerBase
{
    public LifecycleWorker(AbpAsyncTimer timer, IServiceScopeFactory serviceScopeFactory, LifecyclePolicy policy)
        : base(timer, serviceScopeFactory)
    {
        Timer.Period = Math.Max(5, policy.Options.WorkerPeriodSeconds) * 1000;
    }

    protected override async Task DoWorkAsync(PeriodicBackgroundWorkerContext workerContext)
    {
        var sp = workerContext.ServiceProvider;
        var clock = sp.GetRequiredService<IClock>();
        var uowManager = sp.GetRequiredService<IUnitOfWorkManager>();
        var executer = sp.GetRequiredService<IAsyncQueryableExecuter>();
        var owners = sp.GetRequiredService<IRepository<OwnerProfile, Guid>>();
        var lifecycle = sp.GetRequiredService<LifecycleManager>();
        var now = clock.Now;

        List<Guid> ownerIds;
        using (var uow = uowManager.Begin(requiresNew: true))
        {
            var q = await owners.GetQueryableAsync();
            ownerIds = await executer.ToListAsync(q.Where(o =>
                    (o.State == LifecycleState.Active && o.NextCheckInDueAt <= now) ||
                    o.State == LifecycleState.Missed ||
                    o.State == LifecycleState.Grace ||
                    (o.PausedUntil != null && o.PausedUntil <= now))
                .Select(o => o.Id));
            await uow.CompleteAsync();
        }
        foreach (var id in ownerIds)
        {
            await RunIsolatedAsync(uowManager, $"owner {id}", async () =>
                await lifecycle.ProcessOwnerAsync(await owners.GetAsync(id)));
        }
    }

    private async Task RunIsolatedAsync(IUnitOfWorkManager uowManager, string label, Func<Task> action)
    {
        try
        {
            using var uow = uowManager.Begin(requiresNew: true, isTransactional: true);
            await action();
            await uow.CompleteAsync();
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "LifecycleWorker: lỗi khi xử lý {Label}", label);
        }
    }
}
