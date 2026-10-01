using DeathNote.AuditTrail;
using DeathNote.Notifications;
using DeathNote.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Logging;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Domain.Repositories;
using Microsoft.Extensions.Options;
using Volo.Abp.Emailing;
using Volo.Abp.Settings;

namespace DeathNote.EmailTemplates;

/// <summary>
/// Xem / chỉnh / xem trước / gửi thử mẫu email. Mỗi lần lưu hoặc khôi phục được ghi audit log bất biến
/// (nội dung email là lời hệ thống nói với khách hàng — cần truy được ai đã sửa).
/// </summary>
[Authorize(DeathNotePermissions.EmailTemplates.Default)]
public class EmailTemplateAppService : DeathNoteAppService, IEmailTemplateAppService
{
    private readonly IRepository<EmailTemplate, Guid> _templates;
    private readonly IEmailSender _emailSender;
    private readonly ResendOptions _resend;

    public EmailTemplateAppService(IRepository<EmailTemplate, Guid> templates, IEmailSender emailSender, IOptions<ResendOptions> resend)
    {
        _templates = templates;
        _emailSender = emailSender;
        _resend = resend.Value;
    }

    public async Task<ListResultDto<EmailTemplateDto>> GetListAsync()
    {
        var custom = (await _templates.GetListAsync()).ToDictionary(t => t.Key);
        return new ListResultDto<EmailTemplateDto>(
            EmailTemplateDefinitions.All.Select(d => ToDto(d, custom.GetValueOrDefault(d.Key))).ToList());
    }

    public async Task<EmailTemplateDto> GetAsync(string id)
    {
        var definition = EmailTemplateDefinitions.Get(id);
        return ToDto(definition, await _templates.FindAsync(t => t.Key == id));
    }

    public async Task<EmailDeliveryInfoDto> GetDeliveryInfoAsync() => _resend.IsEnabled
        ? new EmailDeliveryInfoDto { Provider = "resend", FromAddress = _resend.FromAddress }
        : new EmailDeliveryInfoDto { Provider = "smtp", FromAddress = await SettingProvider.GetOrNullAsync(EmailSettingNames.DefaultFromAddress) };

    [Authorize(DeathNotePermissions.EmailTemplates.Manage)]
    public async Task<EmailTemplateDto> UpdateAsync(string id, UpdateEmailTemplateInput input)
    {
        var definition = EmailTemplateDefinitions.Get(id);
        EmailTemplateDefinitions.Validate(definition, input.Subject, input.BodyHtml);

        var entity = await _templates.FindAsync(t => t.Key == id);
        if (entity == null)
            entity = await _templates.InsertAsync(new EmailTemplate(GuidGenerator.Create(), id, input.Subject, input.BodyHtml), autoSave: true);
        else
        {
            entity.Update(input.Subject, input.BodyHtml);
            await _templates.UpdateAsync(entity, autoSave: true);
        }

        await RecordAsync(AuditActions.EmailTemplateUpdated, id);
        return ToDto(definition, entity);
    }

    [Authorize(DeathNotePermissions.EmailTemplates.Manage)]
    public async Task<EmailTemplateDto> ResetAsync(string id)
    {
        var definition = EmailTemplateDefinitions.Get(id);
        var entity = await _templates.FindAsync(t => t.Key == id);
        if (entity != null)
        {
            await _templates.DeleteAsync(entity, autoSave: true);
            await RecordAsync(AuditActions.EmailTemplateReset, id);
        }
        return ToDto(definition, null);
    }

    public async Task<EmailPreviewDto> PreviewAsync(string id, UpdateEmailTemplateInput input)
    {
        var (subject, html) = await RenderDraftAsync(id, input);
        return new EmailPreviewDto { Subject = subject, Html = html };
    }

    [Authorize(DeathNotePermissions.EmailTemplates.Manage)]
    public async Task SendTestAsync(string id, SendTestEmailInput input)
    {
        var (subject, html) = await RenderDraftAsync(id, input);
        try
        {
            await _emailSender.SendAsync(input.To, "[Thử] " + subject, html, isBodyHtml: true);
        }
        catch (Exception ex)
        {
            Logger.LogWarning(ex, "Gửi thử mẫu email {Key} thất bại", id);
            throw new BusinessException(DeathNoteErrorCodes.EmailSendFailed).WithData("Reason", ex.Message);
        }
    }

    /// <summary>Dựng thư từ bản nháp với giá trị mẫu. Sửa khung chung → xem trước bằng một thư mẫu bên trong.</summary>
    private async Task<(string Subject, string Html)> RenderDraftAsync(string id, UpdateEmailTemplateInput input)
    {
        var definition = EmailTemplateDefinitions.Get(id);
        EmailTemplateDefinitions.Validate(definition, input.Subject, input.BodyHtml);
        var renderer = LazyServiceProvider.LazyGetRequiredService<EmailTemplateRenderer>();

        if (id == EmailTemplateKeys.Layout)
        {
            var sample = EmailTemplateDefinitions.Get(EmailTemplateKeys.CheckInReminderFirst);
            var (innerSubject, innerBody) = await renderer.RenderAsync(sample.Key, EmailTemplateRenderer.SampleValues(sample));
            return (innerSubject, EmailTemplateRenderer.WrapInLayout(input.BodyHtml, innerSubject, innerBody));
        }

        var (subject, body) = EmailTemplateRenderer.Render(input.Subject, input.BodyHtml, EmailTemplateRenderer.SampleValues(definition));
        return (subject, await renderer.WrapInLayoutAsync(subject, body));
    }

    private Task RecordAsync(string action, string key) =>
        Audit.RecordAsync(new AuditEntry(action, ActorType: AuditActorType.Admin, ActorUserId: UserId, ActorName: CurrentUserDisplayName,
            TargetType: nameof(EmailTemplate), TargetId: key));

    private static EmailTemplateDto ToDto(EmailTemplateDefinition d, EmailTemplate? custom) => new()
    {
        Key = d.Key,
        Name = d.Name,
        Description = d.Description,
        Placeholders = d.Placeholders.Select(p => new EmailTemplatePlaceholderDto
        {
            Name = p.Name, Description = p.Description, SampleValue = p.SampleValue
        }).ToList(),
        Subject = custom?.Subject ?? d.DefaultSubject,
        BodyHtml = custom?.BodyHtml ?? d.DefaultBodyHtml,
        DefaultSubject = d.DefaultSubject,
        DefaultBodyHtml = d.DefaultBodyHtml,
        IsCustomized = custom != null,
        LastModifiedAt = custom == null ? null : custom.LastModificationTime ?? custom.CreationTime
    };
}
