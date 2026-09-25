using Volo.Abp.Account;
using Volo.Abp.Application;
using Volo.Abp.Authorization;
using Volo.Abp.Modularity;

namespace DeathNote;

/// <summary>
/// Hợp đồng của tầng ứng dụng: interface các application service + DTO.
/// Đây cũng là "hợp đồng API" — Swagger/OpenAPI được sinh từ đây và frontend sinh client tự động.
/// </summary>
[DependsOn(
    typeof(DeathNoteDomainSharedModule),
    typeof(AbpDddApplicationContractsModule),
    typeof(AbpAuthorizationModule),
    typeof(AbpAccountApplicationContractsModule)
)]
public class DeathNoteApplicationContractsModule : AbpModule
{
}
