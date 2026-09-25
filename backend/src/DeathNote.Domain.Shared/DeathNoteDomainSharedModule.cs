using DeathNote.Localization;
using Volo.Abp.AuditLogging;
using Volo.Abp.Identity;
using Volo.Abp.Localization;
using Volo.Abp.Localization.ExceptionHandling;
using Volo.Abp.Modularity;
using Volo.Abp.OpenIddict;
using Volo.Abp.PermissionManagement;
using Volo.Abp.SettingManagement;
using Volo.Abp.Validation.Localization;
using Volo.Abp.VirtualFileSystem;

namespace DeathNote;

/// <summary>
/// Lớp "Domain.Shared" — tầng thấp nhất của kiến trúc DDD trong ABP.
/// <para>
/// Chứa những thứ được dùng chung bởi MỌI tầng khác (kể cả client): hằng số, enum trạng thái,
/// mã lỗi và tài nguyên đa ngôn ngữ. Tầng này không phụ thuộc vào CSDL hay HTTP.
/// </para>
/// </summary>
[DependsOn(
    typeof(AbpIdentityDomainSharedModule),
    typeof(AbpOpenIddictDomainSharedModule),
    typeof(AbpPermissionManagementDomainSharedModule),
    typeof(AbpSettingManagementDomainSharedModule),
    typeof(AbpAuditLoggingDomainSharedModule)
)]
public class DeathNoteDomainSharedModule : AbpModule
{
    public override void ConfigureServices(ServiceConfigurationContext context)
    {
        // Nhúng các file JSON đa ngôn ngữ vào assembly để triển khai chỉ cần 1 file DLL.
        Configure<AbpVirtualFileSystemOptions>(options =>
        {
            options.FileSets.AddEmbedded<DeathNoteDomainSharedModule>();
        });

        // Đăng ký resource ngôn ngữ riêng của sản phẩm. Tiếng Việt là ngôn ngữ mặc định.
        Configure<AbpLocalizationOptions>(options =>
        {
            options.Resources
                .Add<DeathNoteResource>("vi")
                .AddBaseTypes(typeof(AbpValidationResource))
                .AddVirtualJson("/Localization/DeathNote");

            options.DefaultResourceType = typeof(DeathNoteResource);
        });

        // Mọi BusinessException có mã bắt đầu bằng "DeathNote:" sẽ được dịch
        // sang thông báo thân thiện dựa trên file JSON ở trên.
        Configure<AbpExceptionLocalizationOptions>(options =>
        {
            options.MapCodeNamespace("DeathNote", typeof(DeathNoteResource));
        });
    }
}
