using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace DeathNote.Notifications;

/// <summary>
/// Bản tuỳ chỉnh của một mẫu email do admin chỉnh trên Console.
/// <para>
/// Chỉ lưu khi admin đã sửa: mẫu chưa có bản ghi thì dùng nội dung mặc định trong
/// <see cref="EmailTemplateDefinitions"/>. "Khôi phục mặc định" = xoá bản ghi.
/// </para>
/// </summary>
public class EmailTemplate : AuditedAggregateRoot<Guid>
{
    public string Key { get; private set; } = default!;
    public string Subject { get; private set; } = default!;
    public string BodyHtml { get; private set; } = default!;

    protected EmailTemplate() { }

    public EmailTemplate(Guid id, string key, string subject, string bodyHtml) : base(id)
    {
        Key = Check.NotNullOrWhiteSpace(key, nameof(key), EmailTemplateKeys.MaxKeyLength);
        Update(subject, bodyHtml);
    }

    public void Update(string subject, string bodyHtml)
    {
        Subject = Check.NotNullOrWhiteSpace(subject, nameof(subject), EmailTemplateKeys.MaxSubjectLength).Trim();
        BodyHtml = Check.NotNullOrWhiteSpace(bodyHtml, nameof(bodyHtml), EmailTemplateKeys.MaxBodyLength);
    }
}
