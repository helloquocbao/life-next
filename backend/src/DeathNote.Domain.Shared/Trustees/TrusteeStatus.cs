namespace DeathNote.Trustees;

/// <summary>Trạng thái lời mời của người được uỷ quyền.</summary>
public enum TrusteeStatus
{
    /// <summary>Đã gửi lời mời, chưa phản hồi.</summary>
    Pending = 0,
    /// <summary>Đã chấp nhận vai trò và tạo khoá cá nhân.</summary>
    Confirmed = 1,
    /// <summary>Quá lâu không phản hồi lời mời.</summary>
    Unresponsive = 2
}
