using DeathNote.Data;
using DeathNote.EntityFrameworkCore;
using DeathNote.Infrastructure;
using DeathNote.Notifications;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using Volo.Abp;
using Volo.Abp.Autofac;
using Volo.Abp.BackgroundWorkers;
using Volo.Abp.BlobStoring;
using Volo.Abp.BlobStoring.FileSystem;
using Volo.Abp.Data;
using Volo.Abp.Modularity;
using Volo.Abp.Threading;
using Volo.Abp.Timing;

namespace DeathNote;

/// <summary>
/// Module test tích hợp: dùng module thật (Application + EF Core + PostgreSQL), chỉ thay đồng hồ,
/// IP request và kênh gửi thông báo bằng bản giả. Background worker tắt — test tự gọi từng bước.
/// </summary>
[DependsOn(
    typeof(DeathNoteApplicationModule),
    typeof(DeathNoteEntityFrameworkCoreModule),
    typeof(AbpAutofacModule),
    typeof(AbpTestBaseModule),
    typeof(AbpBlobStoringFileSystemModule)
)]
public class DeathNoteApplicationTestModule : AbpModule
{
    public override void ConfigureServices(ServiceConfigurationContext context)
    {
        Configure<AbpBackgroundWorkerOptions>(o => o.IsEnabled = false);
        Configure<DeathNoteAppUrlOptions>(_ => { });

        context.Services.Replace(ServiceDescriptor.Singleton<IClock, FakeClock>());
        context.Services.Replace(ServiceDescriptor.Transient<IRequestContext, FakeRequestContext>());
        context.Services.Replace(ServiceDescriptor.Singleton<INotificationSender>(sp => sp.GetRequiredService<CapturingNotificationSender>()));

        var blobs = Path.Combine(Path.GetTempPath(), "deathnote-test-blobs");
        Configure<AbpBlobStoringOptions>(o => o.Containers.ConfigureDefault(c => c.UseFileSystem(fs => fs.BasePath = blobs)));
    }

    public override void OnApplicationInitialization(ApplicationInitializationContext context)
    {
        // CSDL test mới hoàn toàn cho mỗi lần chạy.
        var cs = context.ServiceProvider.GetRequiredService<IConfiguration>().GetConnectionString("Default")!;
        var builder = new NpgsqlConnectionStringBuilder(cs);
        var db = builder.Database;
        builder.Database = "postgres";
        using (var conn = new NpgsqlConnection(builder.ConnectionString))
        {
            conn.Open();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = $"DROP DATABASE IF EXISTS \"{db}\" WITH (FORCE); CREATE DATABASE \"{db}\";";
            cmd.ExecuteNonQuery();
        }
        AsyncHelper.RunSync(async () =>
        {
            using var scope = context.ServiceProvider.CreateScope();
            await scope.ServiceProvider.GetRequiredService<IDeathNoteDbSchemaMigrator>().MigrateAsync();
            await scope.ServiceProvider.GetRequiredService<IDataSeeder>().SeedAsync();
        });
    }
}
