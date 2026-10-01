using System.Collections.Immutable;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Abstractions;
using OpenIddict.Server.AspNetCore;
using Volo.Abp.Guids;
using Volo.Abp.Identity;
using Volo.Abp.OpenIddict;
using Volo.Abp.OpenIddict.ExtensionGrantTypes;
using static OpenIddict.Abstractions.OpenIddictConstants;
using IdentityUser = Volo.Abp.Identity.IdentityUser;
using SignInResult = Microsoft.AspNetCore.Mvc.SignInResult;

namespace DeathNote.Authentication;

/// <summary>
/// Đăng nhập SSO bằng tài khoản Google — <b>chỉ dành cho owner</b> (client <c>DeathNote_App</c>).
/// <para>
/// Giữ nguyên kiểu REST không chuyển trang: SPA lấy ID token qua Google Identity Services rồi gọi
/// <c>POST /connect/token</c> với <c>grant_type=google&amp;id_token=…</c>. Backend kiểm chữ ký + audience
/// của ID token với Google, rồi:
/// </para>
/// <list type="number">
/// <item>đã từng đăng nhập Google (bảng AbpUserLogins khớp <c>sub</c>) → dùng đúng tài khoản đó;</item>
/// <item>chưa, nhưng có tài khoản cùng email (Google xác nhận email) → liên kết Google vào tài khoản đó;</item>
/// <item>chưa có gì → tạo tài khoản mới (không mật khẩu), email đã xác nhận.</item>
/// </list>
/// Sau đó phát access/refresh token y như password grant.
/// </summary>
public class GoogleTokenExtensionGrant : ITokenExtensionGrant
{
    public const string ExtensionGrantName = "google";
    public const string LoginProvider = "Google";

    public string Name => ExtensionGrantName;

    public async Task<IActionResult> HandleAsync(ExtensionGrantContext context)
    {
        var services = context.HttpContext.RequestServices;
        var clientId = services.GetRequiredService<IConfiguration>()["Authentication:Google:ClientId"];
        if (string.IsNullOrWhiteSpace(clientId))
            return Forbid(Errors.UnsupportedGrantType, "Đăng nhập bằng Google chưa được bật trên máy chủ.");

        var idToken = context.Request.GetParameter("id_token")?.ToString();
        if (string.IsNullOrWhiteSpace(idToken))
            return Forbid(Errors.InvalidRequest, "Thiếu id_token của Google.");

        GoogleJsonWebSignature.Payload payload;
        try
        {
            payload = await GoogleJsonWebSignature.ValidateAsync(idToken,
                new GoogleJsonWebSignature.ValidationSettings { Audience = [clientId] });
        }
        catch (Exception e) when (e is InvalidJwtException or Newtonsoft.Json.JsonException or FormatException or ArgumentException)
        {
            // Token sai chữ ký/audience/hết hạn, hoặc chuỗi rác không phải JWT.
            return Forbid(Errors.InvalidGrant, "Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn.");
        }

        if (!payload.EmailVerified || string.IsNullOrWhiteSpace(payload.Email))
            return Forbid(Errors.InvalidGrant, "Tài khoản Google chưa xác minh email.");

        var userManager = services.GetRequiredService<IdentityUserManager>();
        var existing = await userManager.FindByLoginAsync(LoginProvider, payload.Subject)
                       ?? await userManager.FindByEmailAsync(payload.Email);

        // SSO chỉ dành cho owner: tài khoản nội bộ PICO (có vai trò) phải đăng nhập bằng mật khẩu + 2FA ở Admin Console.
        if (existing != null && (await userManager.GetRolesAsync(existing)).Count > 0)
            return Forbid(Errors.AccessDenied, "Tài khoản nội bộ không được đăng nhập bằng Google.");

        var user = await LinkOrCreateUserAsync(userManager, services.GetRequiredService<IGuidGenerator>(), existing, payload);

        if (!user.IsActive || await userManager.IsLockedOutAsync(user))
            return Forbid(Errors.InvalidGrant, "Tài khoản đang bị khoá hoặc ngừng hoạt động.");

        var signInManager = services.GetRequiredService<SignInManager<IdentityUser>>();
        var principal = await signInManager.CreateUserPrincipalAsync(user);
        var scopes = context.Request.GetScopes();
        principal.SetScopes(scopes);
        principal.SetResources(await GetResourcesAsync(services, scopes));
        await services.GetRequiredService<AbpOpenIddictClaimsPrincipalManager>().HandleAsync(context.Request, principal);

        return new SignInResult(OpenIddictServerAspNetCoreDefaults.AuthenticationScheme, principal);
    }

    private static async Task<IdentityUser> LinkOrCreateUserAsync(IdentityUserManager userManager, IGuidGenerator guid,
        IdentityUser? user, GoogleJsonWebSignature.Payload payload)
    {
        if (user != null && await userManager.FindByLoginAsync(LoginProvider, payload.Subject) != null) return user;

        if (user == null)
        {
            user = new IdentityUser(guid.Create(), await PickUserNameAsync(userManager, payload.Email), payload.Email)
            {
                Name = payload.GivenName ?? payload.Name,
                Surname = payload.GivenName != null ? payload.FamilyName : null
            };
            user.SetEmailConfirmed(true);
            (await userManager.CreateAsync(user)).CheckErrors();
        }
        else if (!user.EmailConfirmed)
        {
            // Google đã xác minh chủ hộp thư — coi như email của tài khoản cũ cũng đã xác nhận.
            user.SetEmailConfirmed(true);
            (await userManager.UpdateAsync(user)).CheckErrors();
        }

        (await userManager.AddLoginAsync(user, new UserLoginInfo(LoginProvider, payload.Subject, LoginProvider))).CheckErrors();
        return user;
    }

    /// <summary>Tên đăng nhập = email; trùng (hiếm) thì thêm hậu tố số.</summary>
    private static async Task<string> PickUserNameAsync(IdentityUserManager userManager, string email)
    {
        var candidate = email;
        for (var i = 2; await userManager.FindByNameAsync(candidate) != null; i++) candidate = $"{email}.{i}";
        return candidate;
    }

    private static async Task<IEnumerable<string>> GetResourcesAsync(IServiceProvider services, ImmutableArray<string> scopes)
    {
        var resources = new List<string>();
        if (scopes.IsEmpty) return resources;
        await foreach (var resource in services.GetRequiredService<IOpenIddictScopeManager>().ListResourcesAsync(scopes))
            resources.Add(resource);
        return resources;
    }

    private static ForbidResult Forbid(string error, string description) =>
        new([OpenIddictServerAspNetCoreDefaults.AuthenticationScheme], new AuthenticationProperties(new Dictionary<string, string?>
        {
            [OpenIddictServerAspNetCoreConstants.Properties.Error] = error,
            [OpenIddictServerAspNetCoreConstants.Properties.ErrorDescription] = description
        }));
}
