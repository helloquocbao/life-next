namespace DeathNote.Lifecycle;

/// <summary>
/// Vòng đời của một hồ sơ owner — trái tim của sản phẩm.
/// <code>
///  Active ──quá hạn check-in──▶ Missed ──hết các lần nhắc──▶ Grace
///    ▲                             │                           │ trustee khởi tạo yêu cầu
///    │◀──────── owner check-in / huỷ (1 chạm, mọi giai đoạn) ──┤
///    │                                                         ▼
///    │                 FinalWait ◀──admin duyệt 2 phiếu── Review ◀──đủ m-of-n── Verifying
///    │                     │ hết thời gian chờ cuối
///    │                     ▼
///    │                 Released (không thể quay lại)
/// </code>
/// Nguyên tắc số 1: "Không heartbeat ≠ đã mất". Hết heartbeat chỉ mở quy trình xác minh,
/// KHÔNG mở dữ liệu. Chỉ có đúng một đường đi tới <see cref="Released"/>.
/// </summary>
public enum LifecycleState
{
    /// <summary>Bình thường. Hệ thống nhắc check-in theo chu kỳ.</summary>
    Active = 0,
    /// <summary>Đã quá hạn check-in. Hệ thống leo thang kênh nhắc: push → email → SMS → gọi.</summary>
    Missed = 1,
    /// <summary>Hết các lần nhắc. Người được uỷ quyền được báo "hãy liên lạc với owner".</summary>
    Grace = 2,
    /// <summary>Một trustee đã khởi tạo yêu cầu mở; đang thu đồng thuận m-of-n + bằng chứng.</summary>
    Verifying = 3,
    /// <summary>Đã đủ ngưỡng đồng thuận; đội thẩm định PICO duyệt 2 phiếu độc lập.</summary>
    Review = 4,
    /// <summary>Đã duyệt; chờ 48–72 giờ cuối, bắn cảnh báo tối đa về owner — chốt chặn cuối cùng.</summary>
    FinalWait = 5,
    /// <summary>Đã bàn giao: mảnh khoá được phát cho trustee để tự giải mã phần của mình.</summary>
    Released = 6
}
