namespace DeathNote.Trustees;

/// <summary>
/// Câu trả lời của trustee cho cảnh báo "Anh A chưa check-in X ngày, bạn có liên lạc được không?".
/// Bước này chặn phần lớn báo động giả trước khi bất kỳ ai khởi tạo yêu cầu mở.
/// </summary>
public enum ContactResponse
{
    CanReach = 0,
    CannotReach = 1
}
