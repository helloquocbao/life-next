namespace DeathNote.Releases;

/// <summary>Trạng thái của một yêu cầu mở vault (ReleaseRequest).</summary>
public enum ReleaseStatus
{
    /// <summary>Đang chờ đủ số người giữ khoá đồng thuận.</summary>
    AwaitingConsent = 0,
    /// <summary>Đủ ngưỡng — chờ phiếu 1 (Reviewer).</summary>
    AwaitingFirstReview = 1,
    /// <summary>Đã có phiếu 1 đồng ý — chờ phiếu 2 (Approver, người khác).</summary>
    AwaitingSecondReview = 2,
    /// <summary>Thẩm định viên yêu cầu bổ sung bằng chứng.</summary>
    NeedsMoreInfo = 3,
    /// <summary>Đã duyệt — đang trong thời gian chờ cuối để owner còn cơ hội phủ quyết.</summary>
    FinalWait = 4,
    /// <summary>Đã phát hành mảnh khoá.</summary>
    Released = 5,
    /// <summary>Bị từ chối (thiếu bằng chứng / nghi vấn).</summary>
    Rejected = 6,
    /// <summary>Owner đã check-in / huỷ — quy trình dừng ngay.</summary>
    CancelledByOwner = 7
}
