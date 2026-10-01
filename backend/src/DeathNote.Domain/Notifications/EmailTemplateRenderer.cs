using System.Net;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Domain.Services;

namespace DeathNote.Notifications;

/// <summary>
/// Dựng email từ mẫu: lấy bản tuỳ chỉnh của admin (nếu có) hoặc nội dung mặc định, rồi thay biến <c>{{name}}</c>.
/// </summary>
public class EmailTemplateRenderer : DomainService
{
    private readonly IRepository<EmailTemplate, Guid> _templates;

    public EmailTemplateRenderer(IRepository<EmailTemplate, Guid> templates)
    {
        _templates = templates;
    }

    /// <summary>Tiêu đề + nội dung đang áp dụng (bản tuỳ chỉnh nếu có, ngược lại là mặc định).</summary>
    public async Task<(string Subject, string BodyHtml)> GetEffectiveAsync(string key)
    {
        var definition = EmailTemplateDefinitions.Get(key);
        var custom = await _templates.FindAsync(t => t.Key == key);
        return custom == null ? (definition.DefaultSubject, definition.DefaultBodyHtml) : (custom.Subject, custom.BodyHtml);
    }

    public async Task<(string Subject, string Body)> RenderAsync(string key, IReadOnlyDictionary<string, string?> values)
    {
        var (subject, body) = await GetEffectiveAsync(key);
        return Render(subject, body, values);
    }

    /// <summary>Bọc nội dung một thư vào khung chung (mẫu <see cref="EmailTemplateKeys.Layout"/>).</summary>
    public async Task<string> WrapInLayoutAsync(string title, string contentHtml)
    {
        var (_, layout) = await GetEffectiveAsync(EmailTemplateKeys.Layout);
        return WrapInLayout(layout, title, contentHtml);
    }

    public static string WrapInLayout(string layoutHtml, string title, string contentHtml) =>
        Fill(layoutHtml, new Dictionary<string, string?> { ["title"] = title, [EmailTemplateDefinitions.RawContentPlaceholder] = contentHtml }, htmlEncode: true);

    /// <summary>Thay biến: tiêu đề giữ nguyên văn (thư thuần), nội dung HTML-encode giá trị.</summary>
    public static (string Subject, string Body) Render(string subject, string bodyHtml, IReadOnlyDictionary<string, string?> values) =>
        (Fill(subject, values, htmlEncode: false), Fill(bodyHtml, values, htmlEncode: true));

    private static string Fill(string template, IReadOnlyDictionary<string, string?> values, bool htmlEncode) =>
        EmailTemplateDefinitions.PlaceholderPattern().Replace(template, m =>
        {
            var name = m.Groups[1].Value;
            if (!values.TryGetValue(name, out var value)) return m.Value;
            value ??= string.Empty;
            return htmlEncode && name != EmailTemplateDefinitions.RawContentPlaceholder ? WebUtility.HtmlEncode(value) : value;
        });

    /// <summary>Bộ giá trị mẫu (để xem trước / gửi thử trên Admin Console).</summary>
    public static Dictionary<string, string?> SampleValues(EmailTemplateDefinition definition) =>
        definition.Placeholders.ToDictionary(p => p.Name, p => (string?)p.SampleValue);
}
