using System.ComponentModel.DataAnnotations;
using DeathNote.Releases;
using DeathNote.Trustees;

namespace DeathNote.TrusteePortal;

/// <summary>Thông tin lời mời hiển thị trước khi trustee đăng nhập.</summary>
public class InvitationDto
{
    public string OwnerName { get; set; } = default!;
    public string TrusteeName { get; set; } = default!;
    public TrusteeRole Role { get; set; }
    public string? Relationship { get; set; }
}

public class AcceptInvitationInput
{
    [Required] public string Token { get; set; } = default!;
}

public class KeyringDto
{
    public bool Exists { get; set; }
    public string? PublicKey { get; set; }
    public string? EncryptedPrivateKey { get; set; }
    public string? KdfSalt { get; set; }
    public long KdfOpsLimit { get; set; }
    public long KdfMemLimit { get; set; }
}

public class CreateKeyringInput
{
    [Required, StringLength(128)] public string PublicKey { get; set; } = default!;
    [Required, StringLength(512)] public string EncryptedPrivateKey { get; set; } = default!;
    [Required, StringLength(128)] public string KdfSalt { get; set; } = default!;
    public long KdfOpsLimit { get; set; }
    public long KdfMemLimit { get; set; }
}

/// <summary>Giai đoạn hiển thị cho trustee — mỗi giai đoạn chỉ một việc cần làm.</summary>
public enum TrusteePhase
{
    /// <summary>"Mọi thứ bình thường. Bạn không cần làm gì."</summary>
    Normal = 0,
    /// <summary>Owner đang im lặng — hãy thử liên lạc.</summary>
    Alert = 1,
    /// <summary>Đang có yêu cầu mở (thu đồng thuận / thẩm định / chờ cuối).</summary>
    Verifying = 2,
    /// <summary>Đã bàn giao — mở hộp nhận.</summary>
    Released = 3
}

/// <summary>
/// Một hồ sơ mà người dùng hiện tại là trustee. Dữ liệu được cắt theo đúng bảng "Ai thấy gì":
/// trước giai đoạn cảnh báo, trustee không thấy trạng thái heartbeat của owner.
/// </summary>
public class AssignmentDto
{
    public Guid TrusteeId { get; set; }
    public Guid OwnerId { get; set; }
    public string OwnerName { get; set; } = default!;
    public TrusteeRole Role { get; set; }
    public string? Relationship { get; set; }
    public TrusteePhase Phase { get; set; }
    /// <summary>Số trustee khác (không lộ danh tính trước khi phát hành).</summary>
    public int OtherTrusteeCount { get; set; }
    /// <summary>Số hạng mục được phân cho mình (chỉ số lượng, không nội dung).</summary>
    public int GrantItemCount { get; set; }
    public bool HasKeyShare { get; set; }

    // Chỉ có giá trị từ giai đoạn cảnh báo trở đi
    public int? SilentDays { get; set; }
    public DateTime? LastCheckInAt { get; set; }
    public DateTime? CanInitiateFrom { get; set; }
    public bool CanInitiate { get; set; }
    public ContactResponse? MyContactResponse { get; set; }

    public ReleaseProgressDto? OpenRequest { get; set; }
    public DateTime? ReleasedAt { get; set; }

    /// <summary>Giờ server + hệ số nén thời gian (demo) để client hiển thị đếm ngược chính xác.</summary>
    public DateTime ServerNow { get; set; }
    public double TimeScale { get; set; }
}

public class ContactResponseInput
{
    public Guid TrusteeId { get; set; }
    public ContactResponse Response { get; set; }
}

public class InitiateReleaseInput
{
    public Guid TrusteeId { get; set; }
    public ReleaseReason Reason { get; set; }
    [StringLength(4000)] public string? Statement { get; set; }
}

/// <summary>Màn hình tiến độ đồng thuận: "2/4 người đã đồng ý — cần thêm 1".</summary>
public class ReleaseProgressDto
{
    public Guid Id { get; set; }
    public ReleaseStatus Status { get; set; }
    public ReleaseReason Reason { get; set; }
    public string? Statement { get; set; }
    public string InitiatorName { get; set; } = default!;
    public DateTime InitiatedAt { get; set; }
    public int RequiredConsents { get; set; }
    public int EffectiveConsents { get; set; }
    public int KeyHolderCount { get; set; }
    public List<ConsentBriefDto> Consents { get; set; } = new();
    public bool HaveIConsented { get; set; }
    public bool CanIConsent { get; set; }
    public List<EvidenceBriefDto> Evidence { get; set; } = new();
    public int ReviewRound { get; set; }
    public string? InfoRequestNote { get; set; }
    public DateTime? FinalWaitUntil { get; set; }
    public DateTime? ReleasedAt { get; set; }
    public string? CloseNote { get; set; }
}

public class ConsentBriefDto
{
    public string TrusteeName { get; set; } = default!;
    public DateTime ConsentedAt { get; set; }
}

public class EvidenceBriefDto
{
    public Guid Id { get; set; }
    public EvidenceKind Kind { get; set; }
    public string FileName { get; set; } = default!;
    public long SizeBytes { get; set; }
    public DateTime UploadedAt { get; set; }
}

/// <summary>Vật liệu để trustee đồng thuận: mảnh khoá của mình + khoá công khai của các trustee nhận.</summary>
public class ConsentMaterialDto
{
    public Guid RequestId { get; set; }
    public Guid MyTrusteeId { get; set; }
    public string MySealedShare { get; set; } = default!;
    public List<RecipientKeyDto> Recipients { get; set; } = new();
}

public class RecipientKeyDto
{
    public Guid TrusteeId { get; set; }
    public string DisplayName { get; set; } = default!;
    public string PublicKey { get; set; } = default!;
}

public class ConsentInput
{
    [StringLength(2000)] public string? Statement { get; set; }
    public List<ShareDeliveryInput> Deliveries { get; set; } = new();
}

public class ShareDeliveryInput
{
    public Guid ToTrusteeId { get; set; }
    [Required, StringLength(1024)] public string SealedShare { get; set; } = default!;
}

/// <summary>Hộp nhận sau khi phát hành: đủ mảnh để ghép ReleaseKey + grant riêng của mình.</summary>
public class InboxDto
{
    public Guid TrusteeId { get; set; }
    public string OwnerName { get; set; } = default!;
    public DateTime ReleasedAt { get; set; }
    public int Threshold { get; set; }
    /// <summary>Các mảnh khoá (đã niêm phong cho mình): mảnh gốc của mình (nếu có) + mảnh các trustee khác chuyển.</summary>
    public List<string> SealedShares { get; set; } = new();
    /// <summary>Grant đã khoá hai lớp: niêm phong cho mình, bên trong mã hoá bằng ReleaseKey.</summary>
    public string? SealedGrant { get; set; }
    public int GrantItemCount { get; set; }
}

public class ReleasedItemDto
{
    public Guid Id { get; set; }
    public string Ciphertext { get; set; } = default!;
}

public class GetReleasedItemsInput
{
    public Guid TrusteeId { get; set; }
    public List<Guid> Ids { get; set; } = new();
}
