namespace DeathNote.Infrastructure;

/// <summary>
/// Thông tin của request HTTP hiện tại (IP, trình duyệt) cho audit log và phát hiện rủi ro.
/// Domain chỉ biết interface này; phần cài đặt nằm ở tầng Host (đọc từ HttpContext).
/// </summary>
public interface IRequestContext
{
    string? IpAddress { get; }
    string? UserAgent { get; }
}
