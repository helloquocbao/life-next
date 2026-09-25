using DeathNote.Infrastructure;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Guids;
using Volo.Abp.Linq;
using Volo.Abp.Timing;
using Volo.Abp.Uow;

namespace DeathNote.AuditTrail;

/// <summary>
/// Ghi sự kiện vào audit log bất biến theo chuỗi băm.
/// <para>
/// Mỗi lần ghi chạy trong một unit-of-work RIÊNG (requiresNew): kể cả khi thao tác nghiệp vụ bên ngoài
/// thất bại, dấu vết "đã có người thử làm việc này" vẫn được lưu lại.
/// </para>
/// </summary>
public class AuditTrailManager : ITransientDependency
{
    // Tuần tự hoá việc nối chuỗi trong một tiến trình. Khi chạy nhiều instance, thay bằng
    // PostgreSQL advisory lock (pg_advisory_xact_lock) — xem ghi chú ở tài liệu kiến trúc.
    private static readonly SemaphoreSlim ChainLock = new(1, 1);

    private readonly IRepository<AuditEvent, Guid> _repository;
    private readonly IUnitOfWorkManager _unitOfWorkManager;
    private readonly IAsyncQueryableExecuter _asyncExecuter;
    private readonly IGuidGenerator _guidGenerator;
    private readonly IClock _clock;
    private readonly IRequestContext _requestContext;

    public AuditTrailManager(IRepository<AuditEvent, Guid> repository, IUnitOfWorkManager unitOfWorkManager,
        IAsyncQueryableExecuter asyncExecuter, IGuidGenerator guidGenerator, IClock clock, IRequestContext requestContext)
    {
        _repository = repository;
        _unitOfWorkManager = unitOfWorkManager;
        _asyncExecuter = asyncExecuter;
        _guidGenerator = guidGenerator;
        _clock = clock;
        _requestContext = requestContext;
    }

    public async Task RecordAsync(AuditEntry entry)
    {
        await ChainLock.WaitAsync();
        try
        {
            using var uow = _unitOfWorkManager.Begin(requiresNew: true, isTransactional: true);
            var query = await _repository.GetQueryableAsync();
            var last = await _asyncExecuter.FirstOrDefaultAsync(
                query.OrderByDescending(x => x.Sequence).Select(x => new { x.Sequence, x.Hash }));

            var evt = new AuditEvent(
                _guidGenerator.Create(),
                (last?.Sequence ?? 0) + 1,
                _clock.Now,
                last?.Hash ?? AuditEvent.GenesisHash,
                entry,
                _requestContext.IpAddress);

            await _repository.InsertAsync(evt);
            await uow.CompleteAsync();
        }
        finally
        {
            ChainLock.Release();
        }
    }

    /// <summary>
    /// Kiểm tra toàn vẹn toàn bộ chuỗi: tính lại từng giá trị băm và đối chiếu liên kết với bản ghi trước.
    /// </summary>
    /// <returns>(tổng số bản ghi, số thứ tự bản ghi hỏng đầu tiên — null nếu toàn vẹn).</returns>
    public async Task<(long Total, long? FirstBrokenSequence)> VerifyChainAsync()
    {
        var query = await _repository.GetQueryableAsync();
        var expectedPrev = AuditEvent.GenesisHash;
        long total = 0, lastSeq = 0;
        const int page = 1000;
        while (true)
        {
            var batch = await _asyncExecuter.ToListAsync(
                query.Where(x => x.Sequence > lastSeq).OrderBy(x => x.Sequence).Take(page));
            if (batch.Count == 0) break;
            foreach (var e in batch)
            {
                total++;
                if (e.PreviousHash != expectedPrev || e.ComputeHash() != e.Hash) return (total, e.Sequence);
                expectedPrev = e.Hash;
                lastSeq = e.Sequence;
            }
        }
        return (total, null);
    }
}
