using System.ComponentModel.DataAnnotations;
using DeathNote.Notifications;

namespace DeathNote.EmailTemplates;

public class EmailTemplatePlaceholderDto
{
    public string Name { get; set; } = default!;
    public string Description { get; set; } = default!;
    public string SampleValue { get; set; } = default!;
}

/// <summary>Một mẫu email: nội dung đang áp dụng + nội dung mặc định để so sánh / khôi phục.</summary>
public class EmailTemplateDto
{
    public string Key { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string Description { get; set; } = default!;
    public List<EmailTemplatePlaceholderDto> Placeholders { get; set; } = new();
    public string Subject { get; set; } = default!;
    public string BodyHtml { get; set; } = default!;
    public string DefaultSubject { get; set; } = default!;
    public string DefaultBodyHtml { get; set; } = default!;
    /// <summary>true = admin đã sửa (đang dùng bản lưu trong CSDL).</summary>
    public bool IsCustomized { get; set; }
    public DateTime? LastModifiedAt { get; set; }
}

public class UpdateEmailTemplateInput
{
    [Required, StringLength(EmailTemplateKeys.MaxSubjectLength)]
    public string Subject { get; set; } = default!;

    [Required, StringLength(EmailTemplateKeys.MaxBodyLength)]
    public string BodyHtml { get; set; } = default!;
}

public class SendTestEmailInput : UpdateEmailTemplateInput
{
    [Required, EmailAddress, StringLength(256)]
    public string To { get; set; } = default!;
}

/// <summary>Kết quả xem trước: đã thay biến bằng giá trị mẫu và bọc trong khung chung.</summary>
public class EmailPreviewDto
{
    public string Subject { get; set; } = default!;
    public string Html { get; set; } = default!;
}

/// <summary>Kênh gửi email đang dùng — hiển thị cho admin biết thư thật đi đâu.</summary>
public class EmailDeliveryInfoDto
{
    /// <summary>"resend" hoặc "smtp".</summary>
    public string Provider { get; set; } = default!;
    public string? FromAddress { get; set; }
}
