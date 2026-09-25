using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace DeathNote.EntityFrameworkCore;

/// <summary>Chỉ dùng cho công cụ `dotnet ef` lúc thiết kế (tạo migration).</summary>
public class DeathNoteDbContextFactory : IDesignTimeDbContextFactory<DeathNoteDbContext>
{
    public DeathNoteDbContext CreateDbContext(string[] args)
    {
        AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Path.Combine(Directory.GetCurrentDirectory(), "../DeathNote.HttpApi.Host/"))
            .AddJsonFile("appsettings.json", optional: false)
            .Build();

        var builder = new DbContextOptionsBuilder<DeathNoteDbContext>()
            .UseNpgsql(configuration.GetConnectionString("Default"));
        return new DeathNoteDbContext(builder.Options);
    }
}
