using DeathNote.Notifications;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace DeathNote;

public class EmailTemplateTests
{
    [Fact]
    public void Body_values_are_html_encoded_but_subject_is_plain()
    {
        var (subject, body) = EmailTemplateRenderer.Render(
            "{{ownerName}} đã chọn bạn", "<p>Chào {{ trusteeName }}</p>",
            new Dictionary<string, string?> { ["ownerName"] = "An & Bình", ["trusteeName"] = "<script>x</script>" });

        subject.ShouldBe("An & Bình đã chọn bạn");
        body.ShouldBe("<p>Chào &lt;script&gt;x&lt;/script&gt;</p>");
    }

    [Fact]
    public void Layout_inserts_content_verbatim()
    {
        var html = EmailTemplateRenderer.WrapInLayout("<h2>{{title}}</h2>{{content}}", "A < B", "<p>nội dung</p>");
        html.ShouldBe("<h2>A &lt; B</h2><p>nội dung</p>");
    }

    [Fact]
    public void Default_templates_only_use_declared_placeholders()
    {
        foreach (var d in EmailTemplateDefinitions.All)
            Should.NotThrow(() => EmailTemplateDefinitions.Validate(d, d.DefaultSubject, d.DefaultBodyHtml), d.Key);
    }

    [Fact]
    public void Unknown_placeholder_is_rejected()
    {
        var d = EmailTemplateDefinitions.Get(EmailTemplateKeys.TrusteeCancelled);
        var ex = Should.Throw<BusinessException>(() => EmailTemplateDefinitions.Validate(d, "Xin chào", "<p>{{link}}</p>"));
        ex.Code.ShouldBe(DeathNoteErrorCodes.EmailTemplateUnknownPlaceholder);
    }

    [Fact]
    public void Layout_must_keep_content_placeholder()
    {
        var d = EmailTemplateDefinitions.Get(EmailTemplateKeys.Layout);
        var ex = Should.Throw<BusinessException>(() => EmailTemplateDefinitions.Validate(d, "{{title}}", "<div>{{title}}</div>"));
        ex.Code.ShouldBe(DeathNoteErrorCodes.EmailTemplateMissingContent);
    }
}
