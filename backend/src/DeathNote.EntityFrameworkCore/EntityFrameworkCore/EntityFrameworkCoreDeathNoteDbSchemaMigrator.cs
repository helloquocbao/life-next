using DeathNote.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Volo.Abp.DependencyInjection;

namespace DeathNote.EntityFrameworkCore;

public class EntityFrameworkCoreDeathNoteDbSchemaMigrator : IDeathNoteDbSchemaMigrator, ITransientDependency
{
    private readonly IServiceProvider _serviceProvider;

    public EntityFrameworkCoreDeathNoteDbSchemaMigrator(IServiceProvider serviceProvider) => _serviceProvider = serviceProvider;

    public async Task MigrateAsync()
    {
        // Resolve DbContext qua service provider để lấy đúng connection string theo cấu hình.
        await _serviceProvider.GetRequiredService<DeathNoteDbContext>().Database.MigrateAsync();
    }
}
