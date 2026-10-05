using System.ComponentModel.DataAnnotations;
using DeathNote.Trustees;

namespace DeathNote.TrusteePortal;

/// <summary>Thông tin lời mời hiển thị trước khi trustee đăng nhập.</summary>
public class InvitationDto
{
    public string OwnerName { get; set; } = default!;
    public string TrusteeName { get; set; } = default!;
    public TrusteeRole Role { get; set; }
    public string? Relationship { get; set; }
    /// <summary>True khi hồ sơ đã bàn giao và đây là link nhận thông tin (người nhận chưa từng được mời trước).</summary>
    public bool IsDelivery { get; set; }
}

public class AcceptInvitationInput
{
    [Required] public string Token { get; set; } = default!;
}

/// <summary>Giai đoạn hiển thị cho người được uỷ quyền — mỗi giai đoạn chỉ một việc cần làm.</summary>
public enum TrusteePhase
{
    /// <summary>"Mọi thứ bình thường. Bạn không cần làm gì." Người nhận thông tin luôn ở giai đoạn này cho đến khi bàn giao.</summary>
    Normal = 0,
    /// <summary>Chỉ dành cho người nhắc nhở: owner đang im lặng — hãy liên lạc và nhắc họ bấm "Tôi vẫn ổn".</summary>
    Alert = 1,
    /// <summary>Đã bàn giao. Người nhận mở hộp nhận; người nhắc nhở chỉ được báo là đã xong.</summary>
    Released = 2
}

/// <summary>
/// Một hồ sơ mà người dùng hiện tại được owner giao vai trò. Dữ liệu được cắt theo vai trò + giai đoạn:
/// người nhận thông tin không thấy trạng thái im lặng của owner (owner chưa muốn họ biết); người nhắc nhở thấy
/// từ lúc được báo.
/// </summary>
public class AssignmentDto
{
    public Guid TrusteeId { get; set; }
    public Guid OwnerId { get; set; }
    public string OwnerName { get; set; } = default!;
    public TrusteeRole Role { get; set; }
    public string? Relationship { get; set; }
    public TrusteePhase Phase { get; set; }
    /// <summary>Số hạng mục được phân cho mình (chỉ số lượng, không nội dung). Chỉ có nghĩa với người nhận thông tin.</summary>
    public int GrantItemCount { get; set; }
    /// <summary>Owner đã chuẩn bị phần dành cho mình (đã niêm phong bằng khoá công khai của mình).</summary>
    public bool HasGrant { get; set; }

    // Chỉ có giá trị với người nhắc nhở, từ giai đoạn cảnh báo trở đi
    public int? SilentDays { get; set; }
    public DateTime? LastCheckInAt { get; set; }
    /// <summary>Mốc hết thời gian ân hạn — nếu owner vẫn không check-in thì thông tin tự động được gửi đi.</summary>
    public DateTime? ReleaseAt { get; set; }
    public ContactResponse? MyContactResponse { get; set; }

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

/// <summary>Hộp nhận sau khi bàn giao: phần riêng của mình + khoá giao hàng để mở (chỉ trao cho đúng người nhận đã xác thực).</summary>
public class InboxDto
{
    public Guid TrusteeId { get; set; }
    public string OwnerName { get; set; } = default!;
    public DateTime ReleasedAt { get; set; }
    /// <summary>Grant đã mã hoá bằng khoá giao hàng (thư mở đầu + danh sách hạng mục kèm ItemKey).</summary>
    public string? EncryptedGrant { get; set; }
    /// <summary>Khoá giao hàng (base64) — chỉ có khi hồ sơ đã Released. Giải mã grant ngay trên trình duyệt người nhận.</summary>
    public string? DeliveryKey { get; set; }
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
