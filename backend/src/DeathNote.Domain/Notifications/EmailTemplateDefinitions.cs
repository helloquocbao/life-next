using System.Text.RegularExpressions;
using Volo.Abp;

namespace DeathNote.Notifications;

/// <summary>Một biến có thể chèn vào mẫu email dưới dạng <c>{{name}}</c>.</summary>
public record EmailTemplatePlaceholder(string Name, string Description, string SampleValue);

/// <summary>Khai báo một mẫu email: ý nghĩa, biến được phép dùng và nội dung mặc định.</summary>
public record EmailTemplateDefinition(
    string Key,
    string Name,
    string Description,
    IReadOnlyList<EmailTemplatePlaceholder> Placeholders,
    string DefaultSubject,
    string DefaultBodyHtml);

/// <summary>
/// Danh mục mẫu email (tiếng Việt) + nội dung mặc định. Giọng văn: bình thản, rõ ràng, không dùng hình ảnh
/// tang tóc — đúng tinh thần thiết kế của sản phẩm.
/// <para>
/// Cú pháp biến: <c>{{tenBien}}</c>. Trong nội dung HTML, giá trị biến luôn được HTML-encode (chống chèn mã
/// từ tên do người dùng nhập); riêng <c>{{content}}</c> của khung chung được chèn nguyên văn.
/// </para>
/// </summary>
public static partial class EmailTemplateDefinitions
{
    /// <summary>Biến chèn nguyên văn (không encode) — chỉ là HTML do hệ thống dựng, không phải dữ liệu người dùng.</summary>
    public const string RawContentPlaceholder = "content";

    [GeneratedRegex(@"\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}")]
    public static partial Regex PlaceholderPattern();

    private static string Button(string text) =>
        """<p style="margin:24px 0"><a href="{{link}}" style="background:#2f6f5e;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">"""
        + text + "</a></p>";

    private static readonly EmailTemplatePlaceholder Link = new("link", "Đường dẫn nút bấm trong thư", "https://app.deathnote.local/...");
    private static readonly EmailTemplatePlaceholder OwnerName = new("ownerName", "Tên chủ hồ sơ", "Nguyễn Văn An");
    private static readonly EmailTemplatePlaceholder TrusteeName = new("trusteeName", "Tên người được uỷ quyền nhận thư", "Trần Thị Bình");
    private static readonly EmailTemplatePlaceholder Note = new("note", "Ghi chú của thẩm định viên", "Cần bản chụp rõ giấy chứng tử");

    private static readonly EmailTemplatePlaceholder[] ReminderVars =
    [
        new("name", "Tên chủ hồ sơ", "Nguyễn Văn An"),
        new("attempt", "Lần nhắc hiện tại (bắt đầu từ 1)", "2"),
        new("totalAttempts", "Tổng số lần nhắc", "4"),
        Link
    ];

    private const string ReminderIntro =
        "<p>Chào {{name}},</p><p>Bạn đã quá hạn check-in định kỳ. Chỉ cần bấm nút bên dưới — không cần mở ứng dụng.</p>";

    public static readonly IReadOnlyList<EmailTemplateDefinition> All =
    [
        new(EmailTemplateKeys.Layout, "Khung chung",
            "Bọc ngoài mọi email: tiêu đề lớn và chân thư. Bắt buộc chứa {{content}}.",
            [new("title", "Tiêu đề thư (bằng tiêu đề email)", "Đến lúc xác nhận bạn vẫn ổn"),
             new(RawContentPlaceholder, "Nội dung của từng thư (chèn nguyên văn)", "<p>Nội dung thư…</p>")],
            "{{title}}",
            """
            <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:auto;color:#1f2a2e;line-height:1.55">
              <h2 style="color:#2f6f5e;margin-bottom:8px">{{title}}</h2>
              {{content}}
              <hr style="border:none;border-top:1px solid #e3e8e6;margin:32px 0 12px"/>
              <p style="font-size:12px;color:#6b7a80">Death Note bàn giao thông tin, không xác nhận tình trạng tử vong và không thay thế di chúc hợp pháp.</p>
            </div>
            """),

        new(EmailTemplateKeys.CheckInReminderFirst, "Nhắc check-in — lần đầu",
            "Gửi chủ hồ sơ ngay khi quá hạn check-in.",
            ReminderVars,
            "Đến lúc xác nhận bạn vẫn ổn",
            ReminderIntro + Button("Tôi vẫn ổn")),

        new(EmailTemplateKeys.CheckInReminderRepeat, "Nhắc check-in — các lần tiếp theo",
            "Gửi chủ hồ sơ ở các lần nhắc giữa (chưa phải lần cuối).",
            ReminderVars,
            "Nhắc lần {{attempt}}/{{totalAttempts}}: bạn vẫn ổn chứ?",
            ReminderIntro + Button("Tôi vẫn ổn")),

        new(EmailTemplateKeys.CheckInReminderFinal, "Nhắc check-in — lần cuối",
            "Lần nhắc cuối trước khi hệ thống báo cho người thân.",
            ReminderVars,
            "Nhắc lần {{attempt}}/{{totalAttempts}}: bạn vẫn ổn chứ?",
            ReminderIntro + Button("Tôi vẫn ổn")
            + "<p><b>Đây là lần nhắc cuối.</b> Nếu bạn không phản hồi, hệ thống sẽ bắt đầu báo cho người thân bạn đã chọn.</p>"),

        new(EmailTemplateKeys.TrusteeInvitation, "Lời mời người được uỷ quyền",
            "Gửi khi chủ hồ sơ mời (hoặc hệ thống tự gửi cho người nhắc nhở khi chủ hồ sơ quá hạn).",
            [TrusteeName, OwnerName, new("role", "Vai trò được giao", "người nhận thông tin"), Link],
            "{{ownerName}} đã chọn bạn làm người được uỷ quyền",
            "<p>Chào {{trusteeName}},</p><p><b>{{ownerName}}</b> tin tưởng chọn bạn là <b>{{role}}</b> trên Death Note.</p>"
            + "<p>Trước khi có chuyện gì xảy ra, bạn <b>không cần làm gì thêm</b> ngoài việc nhận lời mời này và <b>không xem được</b> nội dung nào của {{ownerName}}. "
            + "Nếu một ngày {{ownerName}} không còn xác nhận được là vẫn ổn, hệ thống sẽ báo cho bạn đúng việc cần làm.</p>"
            + Button("Xem lời mời")),

        new(EmailTemplateKeys.TrusteeGraceAlert, "Báo người nhắc nhở — chủ hồ sơ im lặng",
            "Gửi người nhắc nhở khi chủ hồ sơ không phản hồi các lần nhắc (bắt đầu thời gian ân hạn).",
            [TrusteeName, OwnerName, new("silentDays", "Số ngày chưa check-in", "21"), new("graceDays", "Số ngày còn lại trước khi thông tin được gửi đi", "14"), Link],
            "{{ownerName}} chưa check-in {{silentDays}} ngày — nhờ bạn liên lạc giúp",
            "<p>Chào {{trusteeName}},</p><p>{{ownerName}} đã không xác nhận an toàn trong <b>{{silentDays}} ngày</b> và không phản hồi các lần nhắc của hệ thống.</p>"
            + "<p>Việc này <b>chưa có nghĩa là có chuyện xấu</b>. Nhờ bạn thử liên lạc và nhắc {{ownerName}} mở ứng dụng bấm <b>\"Tôi vẫn ổn\"</b>.</p>"
            + "<p>Nếu trong <b>{{graceDays}} ngày</b> tới {{ownerName}} vẫn không xác nhận, hệ thống sẽ tự động gửi thông tin {{ownerName}} đã chuẩn bị cho những người nhận.</p>"
            + Button("Mở Death Note")),

        new(EmailTemplateKeys.TrusteeCancelled, "Báo trustee — chủ hồ sơ an toàn",
            "Gửi trustee khi chủ hồ sơ check-in lại, mọi tiến trình bị huỷ.",
            [TrusteeName, OwnerName],
            "{{ownerName}} đã xác nhận an toàn",
            "<p>Chào {{trusteeName}},</p><p>{{ownerName}} vừa xác thực và xác nhận vẫn ổn. Mọi tiến trình cảnh báo/xác minh đã được huỷ. Bạn không cần làm gì thêm.</p>"),

        new(EmailTemplateKeys.TrusteeReleased, "Báo trustee — dữ liệu đã bàn giao",
            "Gửi người nhận thông tin khi hồ sơ được bàn giao (lần đầu họ được báo). Link: tạo mật khẩu nếu chưa có tài khoản, đăng nhập nếu đã có.",
            [TrusteeName, OwnerName, Link],
            "Thông tin {{ownerName}} để lại cho bạn đã sẵn sàng",
            "<p>Chào {{trusteeName}},</p><p>Chúng tôi rất tiếc phải gửi thông báo này. {{ownerName}} đã chuẩn bị sẵn một số thông tin và lời nhắn dành cho bạn.</p>"
            + "<p>Bấm nút bên dưới để xem. Nếu đây là lần đầu bạn dùng Death Note, bạn chỉ cần tạo một mật khẩu; nếu đã có tài khoản, hãy đăng nhập.</p>" + Button("Xem thông tin được để lại")),
    ];

    private static readonly Dictionary<string, EmailTemplateDefinition> ByKey = All.ToDictionary(d => d.Key);

    public static EmailTemplateDefinition? Find(string key) => ByKey.GetValueOrDefault(key);

    public static EmailTemplateDefinition Get(string key) =>
        Find(key) ?? throw new BusinessException(DeathNoteErrorCodes.EmailTemplateNotFound).WithData("Key", key);

    /// <summary>Bảo đảm mẫu chỉ dùng biến đã khai báo (gõ sai tên biến sẽ lọt nguyên "{{...}}" vào thư thật).</summary>
    public static void Validate(EmailTemplateDefinition definition, string subject, string bodyHtml)
    {
        var allowed = definition.Placeholders.Select(p => p.Name).ToHashSet();
        var unknown = PlaceholderPattern().Matches(subject + "\n" + bodyHtml)
            .Select(m => m.Groups[1].Value)
            .Where(n => !allowed.Contains(n))
            .Distinct()
            .ToList();
        if (unknown.Count > 0)
            throw new BusinessException(DeathNoteErrorCodes.EmailTemplateUnknownPlaceholder)
                .WithData("Names", string.Join(", ", unknown.Select(n => "{{" + n + "}}")))
                .WithData("Allowed", string.Join(", ", allowed.Select(n => "{{" + n + "}}")));

        if (definition.Key == EmailTemplateKeys.Layout &&
            !PlaceholderPattern().Matches(bodyHtml).Any(m => m.Groups[1].Value == RawContentPlaceholder))
            throw new BusinessException(DeathNoteErrorCodes.EmailTemplateMissingContent);
    }
}
