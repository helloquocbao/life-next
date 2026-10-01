using DeathNote.AuditTrail;
using DeathNote.Localization;
using Volo.Abp.Application.Services;
using Volo.Abp.Users;

namespace DeathNote;

/// <summary>Lớp cơ sở cho mọi application service của Death Note.</summary>
public abstract class DeathNoteAppService : ApplicationService
{
    protected DeathNoteAppService()
    {
        LocalizationResource = typeof(DeathNoteResource);
    }

    protected AuditTrailManager Audit => LazyServiceProvider.LazyGetRequiredService<AuditTrailManager>();

    protected Guid UserId => CurrentUser.GetId();

    protected string CurrentUserDisplayName =>
        CurrentUser.Name ?? CurrentUser.UserName ?? CurrentUser.Email ?? "unknown";
}
