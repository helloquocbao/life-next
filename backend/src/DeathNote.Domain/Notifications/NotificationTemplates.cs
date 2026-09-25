using System.Net;

namespace DeathNote.Notifications;

/// <summary>
/// Nội dung thông báo (tiếng Việt). Giọng văn: bình thản, rõ ràng, không dùng hình ảnh tang tóc —
/// đúng tinh thần thiết kế của sản phẩm.
/// </summary>
public static class NotificationTemplates
{
    private static string E(string? s) => WebUtility.HtmlEncode(s ?? string.Empty);

    private static string Button(string url, string text) =>
        $"""<p style="margin:24px 0"><a href="{E(url)}" style="background:#2f6f5e;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">{E(text)}</a></p>""";

    public static string Layout(string title, string body) => $"""
        <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:auto;color:#1f2a2e;line-height:1.55">
          <h2 style="color:#2f6f5e;margin-bottom:8px">{E(title)}</h2>
          {body}
          <hr style="border:none;border-top:1px solid #e3e8e6;margin:32px 0 12px"/>
          <p style="font-size:12px;color:#6b7a80">LifeNext bàn giao thông tin, không xác nhận tình trạng tử vong và không thay thế di chúc hợp pháp.</p>
        </div>
        """;

    public static (string Subject, string Body) CheckInReminder(string name, int step, int totalSteps, string link) => (
        step == 0 ? "Đến lúc xác nhận bạn vẫn ổn" : $"Nhắc lần {step + 1}/{totalSteps}: bạn vẫn ổn chứ?",
        $"<p>Chào {E(name)},</p><p>Bạn đã quá hạn check-in định kỳ. Chỉ cần bấm nút bên dưới — không cần mở ứng dụng.</p>"
        + Button(link, "Tôi vẫn ổn")
        + (step + 1 >= totalSteps
            ? "<p><b>Đây là lần nhắc cuối.</b> Nếu bạn không phản hồi, hệ thống sẽ bắt đầu báo cho người thân bạn đã chọn.</p>"
            : string.Empty));

    public static (string Subject, string Body) TrusteeInvitation(string trusteeName, string ownerName, string role, string link) => (
        $"{ownerName} đã chọn bạn làm người được uỷ quyền",
        $"<p>Chào {E(trusteeName)},</p><p><b>{E(ownerName)}</b> tin tưởng chọn bạn là <b>{E(role)}</b> trên LifeNext.</p>"
        + "<p>Điều này có nghĩa là: nếu một ngày {0} không thể tự lo liệu, bạn sẽ là một trong những người giúp gia đình tiếp cận thông tin quan trọng (tài khoản, giấy tờ, lời nhắn). Trước khi điều đó xảy ra, bạn <b>không cần làm gì</b> và <b>không xem được</b> nội dung nào.</p>".Replace("{0}", E(ownerName))
        + Button(link, "Xem lời mời"));

    public static (string Subject, string Body) TrusteeGraceAlert(string trusteeName, string ownerName, int silentDays, string link) => (
        $"{ownerName} chưa check-in {silentDays} ngày — bạn có liên lạc được không?",
        $"<p>Chào {E(trusteeName)},</p><p>{E(ownerName)} đã không xác nhận an toàn trong <b>{silentDays} ngày</b> và không phản hồi các lần nhắc.</p>"
        + $"<p>Việc này <b>chưa có nghĩa là có chuyện xấu</b>. Bạn hãy thử liên lạc với {E(ownerName)} và cho chúng tôi biết kết quả.</p>"
        + Button(link, "Trả lời"));

    public static (string Subject, string Body) OwnerReleaseInitiated(string ownerName, string link) => (
        "Cảnh báo: người thân đang yêu cầu mở hồ sơ của bạn",
        $"<p>Chào {E(ownerName)},</p><p>Một người được uỷ quyền vừa khởi tạo yêu cầu mở hồ sơ vì không liên lạc được với bạn.</p>"
        + "<p>Nếu bạn vẫn ổn, chỉ cần check-in — toàn bộ tiến trình sẽ bị huỷ ngay lập tức.</p>" + Button(link, "Tôi vẫn ổn — huỷ ngay"));

    public static (string Subject, string Body) OwnerFinalWarning(string ownerName, DateTime until, string link) => (
        "CẢNH BÁO CUỐI: hồ sơ của bạn sắp được bàn giao",
        $"<p>Chào {E(ownerName)},</p><p>Yêu cầu mở hồ sơ đã được thẩm định. Nếu bạn không phản hồi, dữ liệu sẽ được bàn giao cho người thân vào <b>{until:HH:mm dd/MM/yyyy} (UTC)</b>.</p>"
        + Button(link, "Tôi vẫn ổn — huỷ ngay"));

    public static (string Subject, string Body) TrusteeRequestOpened(string trusteeName, string ownerName, string link) => (
        $"Có yêu cầu mở hồ sơ của {ownerName} — cần bạn xác nhận",
        $"<p>Chào {E(trusteeName)},</p><p>Một người được uỷ quyền khác đã khởi tạo yêu cầu mở hồ sơ của {E(ownerName)}. Hồ sơ chỉ được mở khi đủ số người đồng thuận, qua thẩm định và thời gian chờ cuối.</p>"
        + Button(link, "Xem và xác nhận"));

    public static (string Subject, string Body) TrusteeCancelled(string trusteeName, string ownerName) => (
        $"{ownerName} đã xác nhận an toàn",
        $"<p>Chào {E(trusteeName)},</p><p>{E(ownerName)} vừa xác thực và xác nhận vẫn ổn. Mọi tiến trình cảnh báo/xác minh đã được huỷ. Bạn không cần làm gì thêm.</p>");

    public static (string Subject, string Body) TrusteeRejected(string trusteeName, string ownerName, string? note, string link) => (
        $"Yêu cầu mở hồ sơ của {ownerName} chưa được chấp thuận",
        $"<p>Chào {E(trusteeName)},</p><p>Đội thẩm định chưa chấp thuận yêu cầu. Lý do: {E(note ?? "chưa đủ bằng chứng")}.</p>" + Button(link, "Xem chi tiết"));

    public static (string Subject, string Body) TrusteeNeedsInfo(string trusteeName, string ownerName, string? note, string link) => (
        $"Cần bổ sung bằng chứng cho hồ sơ của {ownerName}",
        $"<p>Chào {E(trusteeName)},</p><p>Thẩm định viên yêu cầu bổ sung: {E(note)}</p>" + Button(link, "Bổ sung ngay"));

    public static (string Subject, string Body) TrusteeReleased(string trusteeName, string ownerName, string link) => (
        $"Thông tin {ownerName} để lại cho bạn đã sẵn sàng",
        $"<p>Chào {E(trusteeName)},</p><p>Chúng tôi rất tiếc phải gửi thông báo này. {E(ownerName)} đã chuẩn bị sẵn một số thông tin và lời nhắn dành cho bạn.</p>"
        + "<p>Bạn sẽ cần passphrase cá nhân đã tạo khi nhận lời mời để giải mã.</p>" + Button(link, "Mở hộp nhận"));
}
