using Microsoft.Extensions.Configuration;
using OpenIddict.Abstractions;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.OpenIddict.Applications;
using static OpenIddict.Abstractions.OpenIddictConstants;
using OidcPermissions = OpenIddict.Abstractions.OpenIddictConstants.Permissions;

namespace DeathNote.Data;

/// <summary>
/// Đăng ký các ứng dụng client với máy chủ xác thực OpenIddict (OAuth 2.1 / OpenID Connect).
/// <para>
/// Mỗi ứng dụng web là một <b>public client</b> dùng Authorization Code + PKCE — chuẩn bảo mật hiện hành
/// cho SPA (không lưu client secret trên trình duyệt). Ba client tách biệt để có thể áp chính sách
/// khác nhau (vd. admin bắt 2FA, thời hạn phiên ngắn hơn).
/// </para>
/// </summary>
public class OpenIddictDataSeedContributor : IDataSeedContributor, ITransientDependency
{
    public const string ApiScope = "DeathNote";

    private readonly IOpenIddictApplicationManager _applications;
    private readonly IOpenIddictScopeManager _scopes;
    private readonly IConfiguration _configuration;

    public OpenIddictDataSeedContributor(IOpenIddictApplicationManager applications, IOpenIddictScopeManager scopes, IConfiguration configuration)
    {
        _applications = applications;
        _scopes = scopes;
        _configuration = configuration;
    }

    public async Task SeedAsync(DataSeedContext context)
    {
        if (await _scopes.FindByNameAsync(ApiScope) == null)
        {
            await _scopes.CreateAsync(new OpenIddictScopeDescriptor
            {
                Name = ApiScope,
                DisplayName = "LifeNext API",
                Resources = { ApiScope }
            });
        }

        var section = _configuration.GetSection("OpenIddict:Applications");
        await CreateSpaAsync("DeathNote_Owner", "LifeNext — Owner Web", section["DeathNote_Owner:RootUrl"]!);
        await CreateSpaAsync("DeathNote_Trustee", "LifeNext — Trustee Web", section["DeathNote_Trustee:RootUrl"]!);
        await CreateSpaAsync("DeathNote_Admin", "LifeNext — Admin Console", section["DeathNote_Admin:RootUrl"]!);
        await CreateSpaAsync("DeathNote_Swagger", "Swagger UI", section["DeathNote_Swagger:RootUrl"]!, swagger: true);
    }

    private async Task CreateSpaAsync(string clientId, string displayName, string rootUrl, bool swagger = false)
    {
        rootUrl = rootUrl.TrimEnd('/');
        var existing = await _applications.FindByClientIdAsync(clientId);
        if (existing != null) await _applications.DeleteAsync(existing); // luôn đồng bộ theo cấu hình mới nhất

        var descriptor = new AbpApplicationDescriptor
        {
            ClientId = clientId,
            ClientType = ClientTypes.Public,
            ConsentType = ConsentTypes.Implicit,
            DisplayName = displayName,
            ClientUri = rootUrl,
            Permissions =
            {
                OidcPermissions.Endpoints.Authorization,
                OidcPermissions.Endpoints.Token,
                OidcPermissions.Endpoints.EndSession,
                OidcPermissions.GrantTypes.AuthorizationCode,
                OidcPermissions.GrantTypes.RefreshToken,
                OidcPermissions.ResponseTypes.Code,
                OidcPermissions.Scopes.Email,
                OidcPermissions.Scopes.Profile,
                OidcPermissions.Scopes.Roles,
                OidcPermissions.Scopes.Phone,
                OidcPermissions.Prefixes.Scope + ApiScope
            },
            Requirements = { Requirements.Features.ProofKeyForCodeExchange }
        };

        if (swagger)
        {
            descriptor.RedirectUris.Add(new Uri($"{rootUrl}/swagger/oauth2-redirect.html"));
        }
        else
        {
            descriptor.RedirectUris.Add(new Uri($"{rootUrl}/auth/callback"));
            descriptor.PostLogoutRedirectUris.Add(new Uri(rootUrl));
            descriptor.PostLogoutRedirectUris.Add(new Uri($"{rootUrl}/"));
        }

        await _applications.CreateAsync(descriptor);
    }
}
