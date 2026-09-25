using Volo.Abp.Domain.Entities;

namespace DeathNote.Vaults;

/// <summary>
/// Một mảnh Shamir của ReleaseKey, đã được NIÊM PHONG (crypto_box_seal) bằng khoá công khai
/// X25519 của đúng một trustee. Chỉ trustee đó mở được — và một mảnh riêng lẻ vô dụng.
/// </summary>
public class KeyShare : BasicAggregateRoot<Guid>
{
    public Guid OwnerId { get; private set; }
    public Guid TrusteeId { get; private set; }
    public int KeyVersion { get; private set; }
    public string SealedShare { get; private set; } = default!;
    public DateTime CreatedAt { get; private set; }

    protected KeyShare() { }

    public KeyShare(Guid id, Guid ownerId, Guid trusteeId, int keyVersion, string sealedShare, DateTime createdAt) : base(id)
    {
        OwnerId = ownerId;
        TrusteeId = trusteeId;
        KeyVersion = keyVersion;
        SealedShare = sealedShare;
        CreatedAt = createdAt;
    }
}
