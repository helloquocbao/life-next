using System.Security.Cryptography;
using System.Text;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace DeathNote.Trustees;

/// <summary>
/// Một người được uỷ quyền trong hồ sơ của một owner (quan hệ owner ↔ người nhận).
/// Một tài khoản có thể là trustee của nhiều owner khác nhau.
/// </summary>
public class Trustee : FullAuditedAggregateRoot<Guid>
{
    public Guid OwnerId { get; private set; }
    public string DisplayName { get; private set; } = default!;
    public string Email { get; private set; } = default!;
    public string? PhoneNumber { get; private set; }
    /// <summary>Quan hệ với owner (vợ/chồng, con, bạn thân, luật sư…).</summary>
    public string? Relationship { get; private set; }
    public TrusteeRole Role { get; private set; }
    public TrusteeStatus Status { get; private set; }

    /// <summary>Tài khoản đã chấp nhận lời mời (null khi chưa chấp nhận).</summary>
    public Guid? UserId { get; private set; }
    /// <summary>Khoá công khai X25519 của trustee (base64) — owner dùng để niêm phong mảnh khoá/grant.</summary>
    public string? PublicKey { get; private set; }

    /// <summary>SHA-256 của token mời. Token gốc chỉ nằm trong email mời, server không lưu.</summary>
    public string InvitationTokenHash { get; private set; } = default!;
    public DateTime InvitedAt { get; private set; }
    public DateTime? AcceptedAt { get; private set; }

    /// <summary>Phản hồi gần nhất cho cảnh báo "bạn có liên lạc được với owner không?".</summary>
    public ContactResponse? LastContactResponse { get; private set; }
    public DateTime? LastContactResponseAt { get; private set; }

    protected Trustee() { }

    public Trustee(Guid id, Guid ownerId, string displayName, string email, string? phone,
        string? relationship, TrusteeRole role, DateTime now) : base(id)
    {
        OwnerId = ownerId;
        Update(displayName, email, phone, relationship, role);
        Status = TrusteeStatus.Pending;
        InvitedAt = now;
    }

    public void Update(string displayName, string email, string? phone, string? relationship, TrusteeRole role)
    {
        DisplayName = Check.NotNullOrWhiteSpace(displayName, nameof(displayName), 128);
        Email = Check.NotNullOrWhiteSpace(email, nameof(email), 256).Trim().ToLowerInvariant();
        PhoneNumber = phone;
        Relationship = relationship;
        Role = role;
    }

    /// <summary>Sinh token mời mới (dùng khi mời lần đầu hoặc gửi lại). Trả về token gốc để đưa vào email.</summary>
    public string IssueInvitationToken(DateTime now)
    {
        if (Status == TrusteeStatus.Confirmed) throw new BusinessException(DeathNoteErrorCodes.InvitationAlreadyAccepted);
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        InvitationTokenHash = HashToken(token);
        InvitedAt = now;
        return token;
    }

    public bool MatchesToken(string token) =>
        !string.IsNullOrEmpty(InvitationTokenHash) &&
        CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(InvitationTokenHash), Encoding.ASCII.GetBytes(HashToken(token)));

    /// <summary>Trustee chấp nhận vai trò: gắn với tài khoản đăng nhập và (nếu có) khoá công khai.</summary>
    public void Accept(Guid userId, string? publicKey, DateTime now)
    {
        if (Status == TrusteeStatus.Confirmed) throw new BusinessException(DeathNoteErrorCodes.InvitationAlreadyAccepted);
        if (userId == OwnerId) throw new BusinessException(DeathNoteErrorCodes.CannotBeOwnTrustee);
        UserId = userId;
        PublicKey = publicKey;
        AcceptedAt = now;
        Status = TrusteeStatus.Confirmed;
        InvitationTokenHash = string.Empty; // token dùng một lần
    }

    public void SetPublicKey(string publicKey) => PublicKey = publicKey;

    public void RecordContactResponse(ContactResponse response, DateTime now)
    {
        LastContactResponse = response;
        LastContactResponseAt = now;
    }

    public bool IsReadyForKeys => Status == TrusteeStatus.Confirmed && !string.IsNullOrEmpty(PublicKey);

    public static string HashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
