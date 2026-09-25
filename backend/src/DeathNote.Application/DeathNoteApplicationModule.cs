using Volo.Abp.Account;
using Volo.Abp.Application;
using Volo.Abp.Modularity;

namespace DeathNote;

/// <summary>
/// Tầng ứng dụng: điều phối use-case (kiểm tra quyền sở hữu dữ liệu, gọi domain service, map DTO).
/// ABP tự động phơi mọi application service thành REST API (auto API controllers) → /api/app/*.
/// </summary>
[DependsOn(
    typeof(DeathNoteDomainModule),
    typeof(DeathNoteApplicationContractsModule),
    typeof(AbpDddApplicationModule),
    typeof(AbpAccountApplicationModule)
)]
public class DeathNoteApplicationModule : AbpModule
{
}
