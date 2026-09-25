namespace DeathNote.Infrastructure;

/// <summary>Địa chỉ 3 ứng dụng web — dùng để dựng link trong email (check-in, lời mời, cảnh báo).</summary>
public class DeathNoteAppUrlOptions
{
    public string OwnerUrl { get; set; } = "http://localhost:5173";
    public string TrusteeUrl { get; set; } = "http://localhost:5174";
    public string AdminUrl { get; set; } = "http://localhost:5175";
}
