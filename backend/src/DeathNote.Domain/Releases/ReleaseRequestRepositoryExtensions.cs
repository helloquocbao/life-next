using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Linq;

namespace DeathNote.Releases;

/// <summary>Tiện ích nạp ReleaseRequest kèm đầy đủ bảng con (đồng thuận, mảnh khoá chuyển giao, bằng chứng, phiếu duyệt).</summary>
public static class ReleaseRequestRepositoryExtensions
{
    public static Task<IQueryable<ReleaseRequest>> WithAllDetailsAsync(this IRepository<ReleaseRequest, Guid> repository) =>
        repository.WithDetailsAsync(x => x.Consents, x => x.ShareDeliveries, x => x.Evidence, x => x.Votes);

    public static async Task<ReleaseRequest> GetWithDetailsAsync(this IRepository<ReleaseRequest, Guid> repository,
        Guid id, IAsyncQueryableExecuter executer)
    {
        var query = await repository.WithAllDetailsAsync();
        return await executer.FirstOrDefaultAsync(query.Where(x => x.Id == id))
               ?? throw new EntityNotFoundException(typeof(ReleaseRequest), id);
    }
}
