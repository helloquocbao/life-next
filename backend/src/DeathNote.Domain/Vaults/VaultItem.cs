using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace DeathNote.Vaults;

/// <summary>
/// Một hạng mục trong vault: mật khẩu, giấy tờ, tài sản, thư để lại…
/// <para>
/// ZERO-KNOWLEDGE: kể cả LOẠI hạng mục và TIÊU ĐỀ cũng nằm trong <see cref="Ciphertext"/>.
/// Server (và admin) chỉ biết "owner này có N hạng mục, tổng M byte" — đúng bảng "Ai thấy gì".
/// </para>
/// </summary>
public class VaultItem : FullAuditedAggregateRoot<Guid>
{
    public Guid OwnerId { get; private set; }

    /// <summary>
    /// Nội dung JSON của hạng mục đã mã hoá XChaCha20-Poly1305 bằng <see cref="WrappedItemKey"/> (base64, gồm nonce).
    /// </summary>
    public string Ciphertext { get; private set; } = default!;

    /// <summary>
    /// ItemKey riêng của hạng mục, bọc bằng VaultKey. Mỗi hạng mục một khoá để có thể trao
    /// đúng từng hạng mục cho đúng người nhận mà không lộ các hạng mục khác.
    /// </summary>
    public string WrappedItemKey { get; private set; } = default!;

    /// <summary>Kích thước ciphertext (byte) — metadata duy nhất admin được thấy.</summary>
    public int SizeBytes { get; private set; }

    public int CryptoVersion { get; private set; } = DeathNoteConsts.CryptoVersion;

    protected VaultItem() { }

    public VaultItem(Guid id, Guid ownerId, string ciphertext, string wrappedItemKey) : base(id)
    {
        OwnerId = ownerId;
        SetContent(ciphertext, wrappedItemKey);
    }

    public void SetContent(string ciphertext, string wrappedItemKey)
    {
        Check.NotNullOrWhiteSpace(ciphertext, nameof(ciphertext));
        if (ciphertext.Length > DeathNoteConsts.MaxVaultItemCiphertextLength)
            throw new BusinessException(DeathNoteErrorCodes.ItemTooLarge);
        Ciphertext = ciphertext;
        WrappedItemKey = Check.NotNullOrWhiteSpace(wrappedItemKey, nameof(wrappedItemKey));
        SizeBytes = ciphertext.Length;
    }
}
