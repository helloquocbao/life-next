using DeathNote.Authentication;
using DeathNote.Data;
using DeathNote.EntityFrameworkCore;
using DeathNote.Infrastructure;
using DeathNote.Lifecycle;
using DeathNote.Notifications;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Cors;
using Microsoft.OpenApi;
using OpenIddict.Server.AspNetCore;
using OpenIddict.Validation.AspNetCore;
using Volo.Abp;
using Volo.Abp.Account;
using Volo.Abp.Account.Web;
using Volo.Abp.AspNetCore.Mvc;
using Volo.Abp.AspNetCore.Mvc.UI.Theme.Basic;
using Volo.Abp.AspNetCore.Serilog;
using Volo.Abp.Autofac;
using Volo.Abp.Data;
using Volo.Abp.Localization;
using Volo.Abp.Modularity;
using Volo.Abp.OpenIddict;
using Volo.Abp.OpenIddict.ExtensionGrantTypes;
using Microsoft.AspNetCore.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Volo.Abp.Emailing;
using Volo.Abp.Swashbuckle;
using Volo.Abp.UI.Navigation.Urls;

namespace DeathNote;

/// <summary>
/// Host duy nhất của backend MVP: vừa là REST API (/api/app/*), vừa là máy chủ xác thực
/// OpenID Connect (OpenIddict, trang đăng nhập/đăng ký), vừa chạy background worker vòng đời.
/// <para>
/// Khi mở rộng: tách Auth Server riêng (--separate-auth-server) và chạy worker ở tiến trình riêng.
/// </para>
/// </summary>
[DependsOn(
    typeof(DeathNoteApplicationModule),
    typeof(DeathNoteEntityFrameworkCoreModule),
    typeof(AbpAutofacModule),
    typeof(AbpAspNetCoreSerilogModule),
    typeof(AbpSwashbuckleModule),
    typeof(AbpAccountWebOpenIddictModule),
    typeof(AbpAccountHttpApiModule),
    typeof(AbpAspNetCoreMvcUiBasicThemeModule)
)]
public class DeathNoteHttpApiHostModule : AbpModule
{
    public override void PreConfigureServices(ServiceConfigurationContext context)
    {
        var env = context.Services.GetHostingEnvironment();
        var configuration = context.Services.GetConfiguration();

        // API tự xác thực token do chính host phát hành (audience "DeathNote").
        PreConfigure<OpenIddictBuilder>(builder =>
        {
            builder.AddValidation(options =>
            {
                options.AddAudiences("DeathNote");
                options.UseLocalServer();
                options.UseAspNetCore();
            });
        });

        // SSO Google cho owner: grant tuỳ biến "google" trên /connect/token (xem GoogleTokenExtensionGrant).
        PreConfigure<OpenIddictServerBuilder>(b =>
            b.Configure(o => o.GrantTypes.Add(GoogleTokenExtensionGrant.ExtensionGrantName)));

        if (!env.IsDevelopment())
        {
            // Production: dùng chứng chỉ ký/ mã hoá token thật thay cho chứng chỉ dev tự sinh.
            PreConfigure<AbpOpenIddictAspNetCoreOptions>(o => o.AddDevelopmentEncryptionAndSigningCertificate = false);
            PreConfigure<OpenIddictServerBuilder>(b =>
                b.AddProductionEncryptionAndSigningCertificate("openiddict.pfx", configuration["AuthServer:CertificatePassPhrase"]!));
        }
        else
        {
            // Development: KHÔNG dùng chứng chỉ dev mặc định của ABP — chứng chỉ đó được lưu vào
            // X509Store, trên macOS ánh xạ sang Keychain và liên tục đòi mật khẩu đăng nhập máy Mac
            // mỗi lần backend khởi động (lỗi CSSMERR_CSP_USER_CANCELED).
            // Thay bằng khoá "ephemeral": sinh mới trong RAM mỗi lần chạy, không chạm Keychain/ổ đĩa.
            // Hệ quả duy nhất: token cũ mất hiệu lực khi restart backend — chấp nhận được lúc dev.
            PreConfigure<AbpOpenIddictAspNetCoreOptions>(o => o.AddDevelopmentEncryptionAndSigningCertificate = false);
            PreConfigure<OpenIddictServerBuilder>(b => b.AddEphemeralEncryptionKey().AddEphemeralSigningKey());
        }
    }

    public override void ConfigureServices(ServiceConfigurationContext context)
    {
        var configuration = context.Services.GetConfiguration();
        var env = context.Services.GetHostingEnvironment();

        if (!configuration.GetValue<bool>("AuthServer:RequireHttpsMetadata"))
        {
            Configure<OpenIddictServerAspNetCoreOptions>(o => o.DisableTransportSecurityRequirement = true);
        }

        // Bearer token cho API; cookie cho trang đăng nhập.
        context.Services.ForwardIdentityAuthenticationForBearer(OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme);

        Configure<AbpOpenIddictExtensionGrantsOptions>(o =>
            o.Grants.Add(GoogleTokenExtensionGrant.ExtensionGrantName, new GoogleTokenExtensionGrant()));

        Configure<DeathNoteAppUrlOptions>(configuration.GetSection("App:Clients"));
        ConfigureEmail(context.Services, configuration);

        Configure<AppUrlOptions>(options =>
        {
            options.Applications["MVC"].RootUrl = configuration["App:SelfUrl"];
            // Bỏ phần tử rỗng: "" khớp tiền tố với MỌI URL → thành open redirect (VD khi EXTRA_CORS_ORIGINS để trống).
            options.RedirectAllowedUrls.AddRange(configuration["App:RedirectAllowedUrls"]?
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries) ?? []);
        });

        // Ngôn ngữ: tiếng Việt mặc định, tiếng Anh dự phòng.
        Configure<AbpLocalizationOptions>(options =>
        {
            options.Languages.Clear();
            options.Languages.Add(new LanguageInfo("vi", "vi", "Tiếng Việt"));
            options.Languages.Add(new LanguageInfo("en", "en", "English"));
        });

        // Tự động phơi application service thành REST API: /api/app/{service}/{action}
        Configure<AbpAspNetCoreMvcOptions>(options =>
        {
            options.ConventionalControllers.Create(typeof(DeathNoteApplicationModule).Assembly);
        });

        context.Services.AddHttpContextAccessor();
        context.Services.AddTransient<IRequestContext, HttpRequestContext>();

        ConfigureSwagger(context, configuration);
        ConfigureCors(context, configuration);
    }

    /// <summary>Có <c>Resend:ApiKey</c> → gửi email qua Resend HTTP API; không có → giữ SMTP mặc định của ABP (dev: Mailpit).</summary>
    private static void ConfigureEmail(IServiceCollection services, IConfiguration configuration)
    {
        if (string.IsNullOrWhiteSpace(configuration["Resend:ApiKey"])) return;

        services.AddHttpClient(ResendEmailSender.HttpClientName, c =>
        {
            c.BaseAddress = new Uri("https://api.resend.com/");
            c.Timeout = TimeSpan.FromSeconds(20);
        });
        services.Replace(ServiceDescriptor.Transient<IEmailSender, ResendEmailSender>());
    }

    private static void ConfigureSwagger(ServiceConfigurationContext context, IConfiguration configuration)
    {
        context.Services.AddAbpSwaggerGenWithOidc(
            configuration["AuthServer:Authority"]!,
            ["DeathNote"],
            [AbpSwaggerOidcFlows.AuthorizationCode],
            null,
            options =>
            {
                options.SwaggerDoc("v1", new OpenApiInfo
                {
                    Title = "Death Note API",
                    Version = "v1",
                    Description = "API bàn giao di sản số — zero-knowledge, m-of-n, audit bất biến."
                });
                options.DocInclusionPredicate((_, description) =>
                    description.RelativePath?.StartsWith("api/app/") == true
                    || description.RelativePath?.StartsWith("api/abp/application-configuration") == true);
                options.CustomSchemaIds(type => type.FullName!.Replace("DeathNote.", "").Replace("+", "."));
                // Sinh kiểu chính xác cho TypeScript: string không-null thì không có "| null", và là bắt buộc.
                options.SupportNonNullableReferenceTypes();
                options.UseAllOfToExtendReferenceSchemas(); // giữ được "nullable" cho thuộc tính kiểu object/enum
                options.SchemaFilter<RequiredNonNullableSchemaFilter>();
            });
    }

    /// <summary>CORS: chỉ cho phép đúng các ứng dụng web của sản phẩm gọi API (App gộp Owner+Trustee, Admin).</summary>
    private static void ConfigureCors(ServiceConfigurationContext context, IConfiguration configuration)
    {
        context.Services.AddCors(options =>
        {
            options.AddDefaultPolicy(builder =>
            {
                builder
                    .WithOrigins(configuration["App:CorsOrigins"]?
                        .Split(",", StringSplitOptions.RemoveEmptyEntries)
                        .Select(o => o.Trim().TrimEnd('/'))
                        .ToArray() ?? [])
                    .WithAbpExposedHeaders()
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
        });
    }

    public override void OnApplicationInitialization(ApplicationInitializationContext context)
    {
        var app = context.GetApplicationBuilder();
        var env = context.GetEnvironment();

        if (env.IsDevelopment()) app.UseDeveloperExceptionPage();

        app.UseAbpRequestLocalization();
        app.MapAbpStaticAssets();
        app.UseRouting();
        app.UseAbpSecurityHeaders();
        app.UseCors();
        app.UseAuthentication();
        app.UseAbpOpenIddictValidation();
        app.UseUnitOfWork();
        app.UseAuthorization();
        app.UseSwagger();
        app.UseAbpSwaggerUI(options =>
        {
            options.SwaggerEndpoint("/swagger/v1/swagger.json", "Death Note API");
            options.OAuthClientId("DeathNote_Swagger");
            options.OAuthUsePkce();
        });
        app.UseAuditing();
        app.UseAbpSerilogEnrichers();
        app.UseConfiguredEndpoints();
    }

    /// <summary>Tự migrate + seed nếu bật <c>App:MigrateOnStartup</c>, rồi nạp chính sách admin đã chỉnh từ CSDL.</summary>
    public override async Task OnPostApplicationInitializationAsync(ApplicationInitializationContext context)
    {
        var configuration = context.ServiceProvider.GetRequiredService<IConfiguration>();
        using var scope = context.ServiceProvider.CreateScope();
        if (configuration.GetValue<bool>("App:MigrateOnStartup"))
        {
            await scope.ServiceProvider.GetRequiredService<IDeathNoteDbSchemaMigrator>().MigrateAsync();
            await scope.ServiceProvider.GetRequiredService<IDataSeeder>().SeedAsync();
        }
        await scope.ServiceProvider.GetRequiredService<LifecyclePolicyStore>().LoadAsync();
    }
}
