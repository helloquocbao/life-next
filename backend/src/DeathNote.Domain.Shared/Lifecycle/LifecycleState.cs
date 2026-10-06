namespace DeathNote.Lifecycle;

/// <summary>
/// Vòng đời của một hồ sơ owner — trái tim của sản phẩm.
/// <code>
///  Active ──quá hạn check-in──▶ Missed ──hết các lần nhắc──▶ Grace ──hết ân hạn──▶ Released
///    ▲                                                         │                (không thể quay lại)
///    └──────── owner check-in / huỷ (1 chạm, mọi giai đoạn) ───┘
/// </code>
/// Nguyên tắc số 1: "Không heartbeat ≠ đã mất". Chỉ khi owner im lặng suốt giai đoạn nhắc VÀ hết thời gian
/// ân hạn mới tự động bàn giao. Chỉ có đúng một đường đi tới <see cref="Released"/>.
/// </summary>
public enum LifecycleState
{
    /// <summary>Bình thường. Hệ thống nhắc check-in theo chu kỳ.</summary>
    Active = 0,
    /// <summary>Đã quá hạn check-in. Hệ thống leo thang kênh nhắc: push → email → SMS → gọi.</summary>
    Missed = 1,
    /// <summary>Hết các lần nhắc. Người được uỷ quyền được báo "hãy liên lạc với owner".</summary>
    Grace = 2,
    // 3–5 (Verifying/Review/FinalWait) thuộc luồng mở vault thủ công cũ — đã bỏ. Giữ nguyên số của Released vì lưu trong CSDL.
    /// <summary>Đã bàn giao: người nhận tự giải mã phần thông tin được phân cho mình.</summary>
    Released = 6
}
