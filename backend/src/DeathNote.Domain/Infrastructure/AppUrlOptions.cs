namespace DeathNote.Infrastructure;

/// <summary>
/// Địa chỉ ứng dụng web — dùng để dựng link trong email (check-in, lời mời, cảnh báo).
/// <c>AppUrl</c> dùng chung cho cả owner lẫn trustee (1 app gộp, xem OpenIddictDataSeedContributor);
/// <c>AdminUrl</c> tách riêng vì Admin Console là công cụ nội bộ, domain riêng.
/// </summary>
public class DeathNoteAppUrlOptions
{
    public string AppUrl { get; set; } = "http://localhost:5173";
    public string AdminUrl { get; set; } = "http://localhost:5175";
}
