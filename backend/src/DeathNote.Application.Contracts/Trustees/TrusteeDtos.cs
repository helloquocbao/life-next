using System.ComponentModel.DataAnnotations;

namespace DeathNote.Trustees;

/// <summary>Người được uỷ quyền, nhìn từ phía owner.</summary>
public class TrusteeDto
{
    public Guid Id { get; set; }
    public string DisplayName { get; set; } = default!;
    public string Email { get; set; } = default!;
    public string? PhoneNumber { get; set; }
    public string? Relationship { get; set; }
    public TrusteeRole Role { get; set; }
    public TrusteeStatus Status { get; set; }
    /// <summary>Khoá công khai X25519 (base64) — owner dùng để niêm phong mảnh khoá/grant.</summary>
    public string? PublicKey { get; set; }
    public DateTime InvitedAt { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public ContactResponse? LastContactResponse { get; set; }
    public DateTime? LastContactResponseAt { get; set; }
    /// <summary>Đang giữ mảnh khoá của phiên bản hiện hành.</summary>
    public bool HasCurrentKeyShare { get; set; }
    public int GrantItemCount { get; set; }
    public DateTime CreationTime { get; set; }
}

public class SaveTrusteeInput
{
    [Required, StringLength(128)] public string DisplayName { get; set; } = default!;
    [Required, EmailAddress, StringLength(256)] public string Email { get; set; } = default!;
    [StringLength(32)] public string? PhoneNumber { get; set; }
    [StringLength(64)] public string? Relationship { get; set; }
    public TrusteeRole Role { get; set; }
}
