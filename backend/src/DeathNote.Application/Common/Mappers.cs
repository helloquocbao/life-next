using DeathNote.AuditTrail;
using DeathNote.Trustees;
using DeathNote.Vaults;

namespace DeathNote.Common;

/// <summary>
/// Map entity → DTO bằng tay (tường minh, dễ review bảo mật: nhìn là biết trường nào được trả ra ngoài).
/// </summary>
internal static class Mappers
{
    public static AuditEventDto ToDto(this AuditEvent e) => new()
    {
        Sequence = e.Sequence,
        OccurredAt = e.OccurredAt,
        OwnerId = e.OwnerId,
        ActorType = e.ActorType,
        ActorName = e.ActorName,
        Action = e.Action,
        TargetType = e.TargetType,
        TargetId = e.TargetId,
        Detail = e.Detail,
        IpAddress = e.IpAddress,
        Hash = e.Hash
    };

    public static VaultDto ToDto(this Vault? v) => v == null
        ? new VaultDto { Initialized = false, CryptoVersion = DeathNoteConsts.CryptoVersion }
        : new VaultDto
        {
            Initialized = true,
            KdfSalt = v.KdfSalt,
            KdfOpsLimit = v.KdfOpsLimit,
            KdfMemLimit = v.KdfMemLimit,
            PassphraseWrappedKey = v.PassphraseWrappedKey,
            RecoveryWrappedKey = v.RecoveryWrappedKey,
            RecoverySalt = v.RecoverySalt,
            EncryptedAllocation = v.EncryptedAllocation,
            KeyVersion = v.KeyVersion,
            KeysDistributedAt = v.KeysDistributedAt,
            KeysOutdated = v.KeysOutdated,
            CryptoVersion = v.CryptoVersion
        };

    public static VaultItemDto ToDto(this VaultItem i) => new()
    {
        Id = i.Id,
        Ciphertext = i.Ciphertext,
        WrappedItemKey = i.WrappedItemKey,
        SizeBytes = i.SizeBytes,
        CreationTime = i.CreationTime,
        LastModificationTime = i.LastModificationTime
    };

    public static TrusteeDto ToDto(this Trustee t, bool hasGrant, int grantItems) => new()
    {
        Id = t.Id,
        DisplayName = t.DisplayName,
        Email = t.Email,
        PhoneNumber = t.PhoneNumber,
        Relationship = t.Relationship,
        Role = t.Role,
        Status = t.Status,
        PublicKey = t.PublicKey,
        InvitedAt = t.InvitedAt,
        AcceptedAt = t.AcceptedAt,
        LastContactResponse = t.LastContactResponse,
        LastContactResponseAt = t.LastContactResponseAt,
        HasCurrentGrant = hasGrant,
        GrantItemCount = grantItems,
        CreationTime = t.CreationTime
    };
}
