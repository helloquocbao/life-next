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
/// Mỗi ứng dụng web là một <b>public client</b> giao tiếp thuần REST API, không chuyển trang:
/// đăng nhập = <c>POST /connect/token</c> (<c>grant_type=password</c>, xử lý sẵn bởi <c>TokenController</c>
/// của ABP qua ASP.NET Core Identity), đăng ký = <c>POST /api/account/register</c> (AccountAppService có
/// sẵn của ABP), đăng xuất = xoá phiên phía trình duyệt — xem <c>frontend/packages/api/src/auth.ts</c>.
/// Chỉ riêng Swagger UI còn dùng Authorization Code + PKCE (nút "Authorize" của Swagger cần redirect).
/// </para>
/// <para>
/// <c>DeathNote_App</c> dùng chung cho cả owner lẫn trustee — một tài khoản có thể vừa là owner (chủ két
/// của mình) vừa là trustee (được người khác nhờ giữ), nên gộp về 1 app/1 phiên đăng nhập thay vì 2 client
/// tách biệt như trước. <c>DeathNote_Admin</c> vẫn tách riêng vì là công cụ nội bộ, chính sách khác hẳn
/// (bắt buộc 2FA, phiên ngắn hơn, domain riêng không public).
/// </para>
/// </summary>
public class OpenIddictDataSeedContributor : IDataSeedContributor, ITransientDependency
{
    public const string ApiScope = "DeathNote";

    /// <summary>Khớp <c>GoogleTokenExtensionGrant.ExtensionGrantName</c> ở Host.</summary>
    public const string GoogleSsoGrantType = "google";

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
                DisplayName = "Death Note API",
                Resources = { ApiScope }
            });
        }

        var section = _configuration.GetSection("OpenIddict:Applications");
        await CreateSpaAsync("DeathNote_App", "Death Note — App (Owner + Trustee)", section["DeathNote_App:RootUrl"]!, googleSso: true);
        await CreateSpaAsync("DeathNote_Admin", "Death Note — Admin Console", section["DeathNote_Admin:RootUrl"]!);
        await CreateSpaAsync("DeathNote_Swagger", "Swagger UI", section["DeathNote_Swagger:RootUrl"]!, swagger: true);

        // Client cũ trước khi gộp — xoá hẳn nếu môi trường này từng seed qua bản cũ.
        foreach (var staleId in new[] { "DeathNote_Owner", "DeathNote_Trustee" })
        {
            var stale = await _applications.FindByClientIdAsync(staleId);
            if (stale != null) await _applications.DeleteAsync(stale);
        }
    }

    private async Task CreateSpaAsync(string clientId, string displayName, string rootUrl, bool swagger = false, bool googleSso = false)
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
                OidcPermissions.Endpoints.Token,
                OidcPermissions.GrantTypes.RefreshToken,
                OidcPermissions.Scopes.Email,
                OidcPermissions.Scopes.Profile,
                OidcPermissions.Scopes.Roles,
                OidcPermissions.Scopes.Phone,
                OidcPermissions.Prefixes.Scope + ApiScope
            }
        };

        if (swagger)
        {
            descriptor.Permissions.Add(OidcPermissions.Endpoints.Authorization);
            descriptor.Permissions.Add(OidcPermissions.GrantTypes.AuthorizationCode);
            descriptor.Permissions.Add(OidcPermissions.ResponseTypes.Code);
            descriptor.Requirements.Add(Requirements.Features.ProofKeyForCodeExchange);
            descriptor.RedirectUris.Add(new Uri($"{rootUrl}/swagger/oauth2-redirect.html"));
        }
        else
        {
            descriptor.Permissions.Add(OidcPermissions.GrantTypes.Password);
        }

        // SSO Google chỉ mở cho App (owner) — Admin Console vẫn bắt buộc mật khẩu + 2FA.
        if (googleSso) descriptor.Permissions.Add(OidcPermissions.Prefixes.GrantType + GoogleSsoGrantType);

        await _applications.CreateAsync(descriptor);
    }
}
