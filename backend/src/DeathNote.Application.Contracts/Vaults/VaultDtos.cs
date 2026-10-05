using System.ComponentModel.DataAnnotations;

namespace DeathNote.Vaults;

/// <summary>
/// Vật liệu khoá của vault (TẤT CẢ đã được bọc). Client dùng passphrase để mở VaultKey ngay trên trình duyệt.
/// </summary>
public class VaultDto
{
    public bool Initialized { get; set; }
    public string? KdfSalt { get; set; }
    public long KdfOpsLimit { get; set; }
    public long KdfMemLimit { get; set; }
    public string? PassphraseWrappedKey { get; set; }
    public string? RecoveryWrappedKey { get; set; }
    public string? RecoverySalt { get; set; }
    public string? EncryptedAllocation { get; set; }
    public int KeyVersion { get; set; }
    public DateTime? KeysDistributedAt { get; set; }
    public bool KeysOutdated { get; set; }
    public int CryptoVersion { get; set; }
}

public class InitializeVaultInput
{
    [Required, StringLength(128)] public string KdfSalt { get; set; } = default!;
    public long KdfOpsLimit { get; set; }
    public long KdfMemLimit { get; set; }
    [Required, StringLength(512)] public string PassphraseWrappedKey { get; set; } = default!;
    [Required, StringLength(512)] public string RecoveryWrappedKey { get; set; } = default!;
    [Required, StringLength(128)] public string RecoverySalt { get; set; } = default!;
}

public class ChangePassphraseInput
{
    [Required, StringLength(128)] public string KdfSalt { get; set; } = default!;
    public long KdfOpsLimit { get; set; }
    public long KdfMemLimit { get; set; }
    [Required, StringLength(512)] public string PassphraseWrappedKey { get; set; } = default!;
}

public class VaultItemDto
{
    public Guid Id { get; set; }
    public string Ciphertext { get; set; } = default!;
    public string WrappedItemKey { get; set; } = default!;
    public int SizeBytes { get; set; }
    public DateTime CreationTime { get; set; }
    public DateTime? LastModificationTime { get; set; }
}

public class SaveVaultItemInput
{
    /// <summary>Id do client sinh (để client có thể tham chiếu trước khi lưu, vd. trong ma trận phân bổ).</summary>
    public Guid? Id { get; set; }
    [Required] public string Ciphertext { get; set; } = default!;
    [Required, StringLength(512)] public string WrappedItemKey { get; set; } = default!;
}

/// <summary>
/// "Ai nhận gì": ma trận phân bổ (mã hoá bằng VaultKey, để owner chỉnh lại về sau) + một Grant cho mỗi người nhận.
/// Mỗi Grant được mã hoá ngay trên trình duyệt owner bằng một khoá giao hàng riêng cho người đó; server giữ khoá giao hàng
/// (mã hoá bằng khoá chủ cấu hình) và chỉ trao cho người nhận khi hồ sơ được bàn giao.
/// </summary>
public class DistributeKeysInput
{
    public string? EncryptedAllocation { get; set; }
    public List<SealedGrantInput> Grants { get; set; } = new();
}

public class SealedGrantInput
{
    public Guid TrusteeId { get; set; }
    /// <summary>GrantPayload đã mã hoá bằng khoá giao hàng (client mã hoá).</summary>
    [Required] public string SealedPayload { get; set; } = default!;
    /// <summary>Khoá giao hàng (base64). Server mã hoá bằng khoá chủ rồi giữ; chỉ trao cho người nhận sau khi bàn giao.</summary>
    [Required, StringLength(128)] public string DeliveryKey { get; set; } = default!;
    [Range(0, 10000)] public int ItemCount { get; set; }
}
