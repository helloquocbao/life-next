using Volo.Abp.DependencyInjection;
using Volo.Abp.Ui.Branding;

namespace DeathNote;

/// <summary>Tên + logo hiển thị trên trang đăng nhập/đăng ký (thay cho "MyApplication" mặc định của ABP).</summary>
[Dependency(ReplaceServices = true)]
public class DeathNoteBrandingProvider : DefaultBrandingProvider
{
    public override string AppName => "LifeNext";
    public override string LogoUrl => "/images/logo.svg";
}
