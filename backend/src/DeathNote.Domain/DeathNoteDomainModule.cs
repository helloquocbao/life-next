using DeathNote.Lifecycle;
using DeathNote.Notifications;
using Microsoft.Extensions.DependencyInjection;
using Volo.Abp;
using Volo.Abp.AuditLogging;
using Volo.Abp.BackgroundWorkers;
using Volo.Abp.BlobStoring;
using Volo.Abp.Emailing;
using Volo.Abp.Identity;
using Volo.Abp.Modularity;
using Volo.Abp.OpenIddict;
using Volo.Abp.PermissionManagement.Identity;
using Volo.Abp.PermissionManagement.OpenIddict;
using Volo.Abp.SettingManagement;
using Volo.Abp.Timing;

namespace DeathNote;

/// <summary>
/// Tầng Domain — nơi chứa TOÀN BỘ luật nghiệp vụ cốt lõi:
/// <list type="bullet">
/// <item>State machine vòng đời hồ sơ (<see cref="Owners.OwnerProfile"/>)</item>
/// <item>Quy trình mở vault 4 cổng: thời gian, con người, bằng chứng, mật mã (<see cref="Releases.ReleaseRequest"/>)</item>
/// <item>Audit log append-only có chuỗi băm (<see cref="AuditTrail.AuditTrailManager"/>)</item>
/// <item>Background worker tự động chuyển trạng thái theo thời gian (<see cref="LifecycleWorker"/>)</item>
/// </list>
/// Tầng này không biết gì về HTTP hay giao diện, nên luật nghiệp vụ được kiểm thử độc lập.
/// </summary>
[DependsOn(
    typeof(DeathNoteDomainSharedModule),
    typeof(AbpIdentityDomainModule),
    typeof(AbpOpenIddictDomainModule),
    typeof(AbpPermissionManagementDomainIdentityModule),
    typeof(AbpPermissionManagementDomainOpenIddictModule),
    typeof(AbpSettingManagementDomainModule),
    typeof(AbpAuditLoggingDomainModule),
    typeof(AbpEmailingModule),
    typeof(AbpBlobStoringModule),
    typeof(AbpBackgroundWorkersModule)
)]
public class DeathNoteDomainModule : AbpModule
{
    public override void ConfigureServices(ServiceConfigurationContext context)
    {
        var configuration = context.Services.GetConfiguration();

        // Chính sách vòng đời đọc từ appsettings: "DeathNote:Policy".
        Configure<LifecyclePolicyOptions>(configuration.GetSection("DeathNote:Policy"));

        // Kênh gửi email: "Resend" (API key qua user-secrets / biến môi trường), để trống → SMTP.
        Configure<ResendOptions>(configuration.GetSection("Resend"));

        // Mọi mốc thời gian lưu ở UTC — tránh sai lệch khi owner đi nước ngoài / đổi múi giờ.
        Configure<AbpClockOptions>(options => options.Kind = DateTimeKind.Utc);
    }

    public override async Task OnApplicationInitializationAsync(ApplicationInitializationContext context)
    {
        // Worker quét định kỳ: quá hạn check-in, leo thang nhắc, hết thời gian chờ cuối, xoá bằng chứng hết hạn.
        await context.AddBackgroundWorkerAsync<LifecycleWorker>();
    }
}
