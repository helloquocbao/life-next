namespace DeathNote.Trustees;

/// <summary>Trạng thái lời mời của người được uỷ quyền.</summary>
public enum TrusteeStatus
{
    /// <summary>Đã gửi lời mời, chưa phản hồi.</summary>
    Pending = 0,
    /// <summary>Đã chấp nhận vai trò và tạo khoá cá nhân.</summary>
    Confirmed = 1,
    /// <summary>Quá lâu không phản hồi lời mời.</summary>
    Unresponsive = 2,
    /// <summary>
    /// Owner đã thêm nhưng CHƯA gửi lời mời — mặc định họ không biết gì về việc này. Hệ thống tự
    /// động gửi lời mời khi owner thật sự bị Missed (bỏ lỡ xác nhận), trừ khi owner chủ động bấm
    /// "Gửi lời mời ngay" từ trước.
    /// </summary>
    NotInvitedYet = 3
}
