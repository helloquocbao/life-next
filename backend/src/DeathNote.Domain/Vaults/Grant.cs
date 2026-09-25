using Volo.Abp.Domain.Entities;

namespace DeathNote.Vaults;

/// <summary>
/// "Ai nhận gì": danh sách hạng mục (kèm ItemKey) được phân cho một trustee.
/// <para>
/// Payload được KHOÁ HAI LỚP: mã hoá bằng ReleaseKey (chỉ có sau khi đủ m-of-n) rồi niêm phong
/// bằng khoá công khai của trustee nhận. Nghĩa là:
/// </para>
/// <list type="bullet">
/// <item>Trước khi phát hành: chính trustee cũng không đọc được mình được nhận gì.</item>
/// <item>Sau khi phát hành: trustee A không đọc được phần của trustee B.</item>
/// <item>Server chỉ thấy "trustee X có N hạng mục" (<see cref="ItemCount"/>).</item>
/// </list>
/// </summary>
public class Grant : BasicAggregateRoot<Guid>
{
    public Guid OwnerId { get; private set; }
    public Guid TrusteeId { get; private set; }
    public int KeyVersion { get; private set; }
    public string SealedPayload { get; private set; } = default!;
    public int ItemCount { get; private set; }
    public DateTime CreatedAt { get; private set; }

    protected Grant() { }

    public Grant(Guid id, Guid ownerId, Guid trusteeId, int keyVersion, string sealedPayload, int itemCount, DateTime createdAt) : base(id)
    {
        OwnerId = ownerId;
        TrusteeId = trusteeId;
        KeyVersion = keyVersion;
        SealedPayload = sealedPayload;
        ItemCount = itemCount;
        CreatedAt = createdAt;
    }
}
