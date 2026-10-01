using Volo.Abp.DependencyInjection;

namespace DeathNote.Notifications;

/// <summary>
/// Điểm gọi có kiểu cho từng loại thông báo: ánh xạ tham số nghiệp vụ → biến của mẫu email
/// (<see cref="EmailTemplateDefinitions"/>). Nội dung thư do admin chỉnh được trên Console.
/// </summary>
public class NotificationTemplates : ITransientDependency
{
    private readonly EmailTemplateRenderer _renderer;

    public NotificationTemplates(EmailTemplateRenderer renderer)
    {
        _renderer = renderer;
    }

    private Task<(string Subject, string Body)> R(string key, params (string Name, string? Value)[] values) =>
        _renderer.RenderAsync(key, values.ToDictionary(v => v.Name, v => v.Value));

    public Task<(string Subject, string Body)> CheckInReminderAsync(string name, int step, int totalSteps, string link)
    {
        var key = step + 1 >= totalSteps ? EmailTemplateKeys.CheckInReminderFinal
            : step == 0 ? EmailTemplateKeys.CheckInReminderFirst
            : EmailTemplateKeys.CheckInReminderRepeat;
        return R(key, ("name", name), ("attempt", (step + 1).ToString()), ("totalAttempts", totalSteps.ToString()), ("link", link));
    }

    public Task<(string Subject, string Body)> TrusteeInvitationAsync(string trusteeName, string ownerName, string role, string link) =>
        R(EmailTemplateKeys.TrusteeInvitation, ("trusteeName", trusteeName), ("ownerName", ownerName), ("role", role), ("link", link));

    public Task<(string Subject, string Body)> TrusteeGraceAlertAsync(string trusteeName, string ownerName, int silentDays, string link) =>
        R(EmailTemplateKeys.TrusteeGraceAlert, ("trusteeName", trusteeName), ("ownerName", ownerName), ("silentDays", silentDays.ToString()), ("link", link));

    public Task<(string Subject, string Body)> OwnerReleaseInitiatedAsync(string ownerName, string link) =>
        R(EmailTemplateKeys.OwnerReleaseInitiated, ("ownerName", ownerName), ("link", link));

    public Task<(string Subject, string Body)> OwnerFinalWarningAsync(string ownerName, DateTime until, string link) =>
        R(EmailTemplateKeys.OwnerFinalWarning, ("ownerName", ownerName), ("releaseAt", until.ToString("HH:mm dd/MM/yyyy")), ("link", link));

    public Task<(string Subject, string Body)> TrusteeRequestOpenedAsync(string trusteeName, string ownerName, string link) =>
        R(EmailTemplateKeys.TrusteeRequestOpened, ("trusteeName", trusteeName), ("ownerName", ownerName), ("link", link));

    public Task<(string Subject, string Body)> TrusteeCancelledAsync(string trusteeName, string ownerName) =>
        R(EmailTemplateKeys.TrusteeCancelled, ("trusteeName", trusteeName), ("ownerName", ownerName));

    public Task<(string Subject, string Body)> TrusteeRejectedAsync(string trusteeName, string ownerName, string? note, string link) =>
        R(EmailTemplateKeys.TrusteeRejected, ("trusteeName", trusteeName), ("ownerName", ownerName), ("note", note ?? "chưa đủ bằng chứng"), ("link", link));

    public Task<(string Subject, string Body)> TrusteeNeedsInfoAsync(string trusteeName, string ownerName, string? note, string link) =>
        R(EmailTemplateKeys.TrusteeNeedsInfo, ("trusteeName", trusteeName), ("ownerName", ownerName), ("note", note), ("link", link));

    public Task<(string Subject, string Body)> TrusteeReleasedAsync(string trusteeName, string ownerName, string link) =>
        R(EmailTemplateKeys.TrusteeReleased, ("trusteeName", trusteeName), ("ownerName", ownerName), ("link", link));
}
