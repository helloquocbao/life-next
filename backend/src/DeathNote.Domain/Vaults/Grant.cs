using Volo.Abp.Domain.Entities;

namespace DeathNote.Vaults;

/// <summary>
/// "Ai nhận gì": danh sách hạng mục (kèm ItemKey) + thư được phân cho một người nhận.
/// <para>
/// Payload được MÃ HOÁ NGAY TRÊN TRÌNH DUYỆT OWNER bằng một "khoá giao hàng" ngẫu nhiên riêng cho người nhận
/// (<see cref="SealedPayload"/>). Khoá giao hàng được server giữ ở dạng mã hoá bằng khoá chủ cấu hình trên máy chủ
/// (<see cref="EscrowedKey"/>, xem <see cref="GrantEscrow"/>) và chỉ trao cho ĐÚNG người nhận sau khi hồ sơ Released:
/// </para>
/// <list type="bullet">
/// <item>Trước khi bàn giao: không API nào trả khoá giao hàng; người nhận cũng không hề biết mình có phần.</item>
/// <item>Sau khi bàn giao: người nhận A không đọc được phần của người nhận B (mỗi người một khoá).</item>
/// <item>Server chỉ thấy "người nhận X có N hạng mục" (<see cref="ItemCount"/>).</item>
/// </list>
/// </summary>
public class Grant : BasicAggregateRoot<Guid>
{
    public Guid OwnerId { get; private set; }
    public Guid TrusteeId { get; private set; }
    public int KeyVersion { get; private set; }
    /// <summary>GrantPayload đã mã hoá bằng khoá giao hàng (client mã hoá, server không đọc được nếu không có khoá).</summary>
    public string SealedPayload { get; private set; } = default!;
    /// <summary>Khoá giao hàng đã mã hoá bằng khoá chủ của máy chủ. Null ở dữ liệu cũ (không còn mở được).</summary>
    public string? EscrowedKey { get; private set; }
    public int ItemCount { get; private set; }
    public DateTime CreatedAt { get; private set; }

    protected Grant() { }

    public Grant(Guid id, Guid ownerId, Guid trusteeId, int keyVersion, string sealedPayload, string escrowedKey, int itemCount, DateTime createdAt) : base(id)
    {
        OwnerId = ownerId;
        TrusteeId = trusteeId;
        KeyVersion = keyVersion;
        SealedPayload = sealedPayload;
        EscrowedKey = escrowedKey;
        ItemCount = itemCount;
        CreatedAt = createdAt;
    }
}
