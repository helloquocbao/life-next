using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace DeathNote.Vaults;

/// <summary>
/// Két dữ liệu của owner — chỉ chứa VẬT LIỆU KHOÁ ĐÃ ĐƯỢC BỌC, không bao giờ chứa khoá rõ.
/// <para><b>Sơ đồ khoá (tất cả được sinh và xử lý trên thiết bị của owner):</b></para>
/// <code>
///  passphrase ──Argon2id(salt)──▶ KEK₁ ─┐
///  12 từ khôi phục ──Argon2id──▶ KEK₂ ─┼──bọc──▶ VaultKey (32 byte, ngẫu nhiên)
///                                       │            │
///                                       │            ├──bọc──▶ ItemKey của từng hạng mục
///                                       │            └──bọc──▶ ReleaseKey
///                                       │
///  ReleaseKey ──Shamir(m, n)──▶ n mảnh ──mỗi mảnh niêm phong bằng khoá công khai của 1 trustee──▶ KeyShare
/// </code>
/// Server chỉ giữ ciphertext. Nếu toàn bộ hạ tầng bị chiếm quyền, kẻ tấn công vẫn cần khoá riêng
/// của đủ m trustee mới đọc được dữ liệu.
/// </summary>
public class Vault : FullAuditedAggregateRoot<Guid>
{
    /// <summary>Id vault = Id owner (1-1).</summary>
    public Guid OwnerId => Id;

    // --- Tham số dẫn xuất khoá từ passphrase (Argon2id) ---
    public string KdfSalt { get; private set; } = default!;
    public long KdfOpsLimit { get; private set; }
    public long KdfMemLimit { get; private set; }

    /// <summary>VaultKey được bọc bằng khoá dẫn xuất từ passphrase — đường owner dùng hằng ngày.</summary>
    public string PassphraseWrappedKey { get; private set; } = default!;
    /// <summary>VaultKey được bọc bằng khoá dẫn xuất từ 12 từ khôi phục — dùng khi quên passphrase / mất máy.</summary>
    public string RecoveryWrappedKey { get; private set; } = default!;
    public string RecoverySalt { get; private set; } = default!;

    /// <summary>ReleaseKey được bọc bằng VaultKey (owner cần để phân bổ lại grant khi thay đổi người nhận).</summary>
    public string? WrappedReleaseKey { get; private set; }

    /// <summary>
    /// Ma trận phân bổ "hạng mục × người nhận" + thư mở đầu cho từng người, mã hoá bằng VaultKey.
    /// Chỉ owner đọc lại được để chỉnh sửa; trustee nhận bản sao riêng qua <see cref="Grant"/>.
    /// </summary>
    public string? EncryptedAllocation { get; private set; }

    // --- Cấu hình m-of-n hiện hành ---
    /// <summary>m: số người giữ khoá tối thiểu phải đồng thuận.</summary>
    public int? Threshold { get; private set; }
    /// <summary>n: tổng số người giữ mảnh khoá.</summary>
    public int? KeyHolderCount { get; private set; }
    /// <summary>Tăng mỗi lần owner phân mảnh lại khoá; mảnh khoá cũ bị vô hiệu.</summary>
    public int KeyVersion { get; private set; }
    public DateTime? KeysDistributedAt { get; private set; }
    /// <summary>
    /// True khi danh sách trustee thay đổi sau lần phân mảnh gần nhất → owner cần phân mảnh lại.
    /// Home screen sẽ nhắc việc này như "một việc nên làm tiếp".
    /// </summary>
    public bool KeysOutdated { get; private set; }

    public int CryptoVersion { get; private set; } = DeathNoteConsts.CryptoVersion;

    protected Vault() { }

    public Vault(Guid ownerId, string kdfSalt, long opsLimit, long memLimit,
        string passphraseWrappedKey, string recoveryWrappedKey, string recoverySalt) : base(ownerId)
    {
        KdfSalt = Check.NotNullOrWhiteSpace(kdfSalt, nameof(kdfSalt));
        KdfOpsLimit = opsLimit;
        KdfMemLimit = memLimit;
        PassphraseWrappedKey = Check.NotNullOrWhiteSpace(passphraseWrappedKey, nameof(passphraseWrappedKey));
        RecoveryWrappedKey = Check.NotNullOrWhiteSpace(recoveryWrappedKey, nameof(recoveryWrappedKey));
        RecoverySalt = Check.NotNullOrWhiteSpace(recoverySalt, nameof(recoverySalt));
    }

    /// <summary>Đổi passphrase: client giải bọc VaultKey bằng passphrase cũ rồi bọc lại bằng passphrase mới.</summary>
    public void ChangePassphrase(string kdfSalt, long opsLimit, long memLimit, string passphraseWrappedKey)
    {
        KdfSalt = kdfSalt;
        KdfOpsLimit = opsLimit;
        KdfMemLimit = memLimit;
        PassphraseWrappedKey = passphraseWrappedKey;
    }

    /// <summary>
    /// Ghi nhận một lần phân mảnh khoá mới. Kiểm tra ngưỡng m-of-n hợp lệ:
    /// n ≥ 2 thì m phải ≥ 2 — không ai được phép một mình mở vault.
    /// </summary>
    public void RegisterKeyDistribution(int threshold, int keyHolderCount, string wrappedReleaseKey, string? encryptedAllocation, DateTime now)
    {
        var min = keyHolderCount >= 2 ? 2 : 1;
        if (keyHolderCount < 1 || threshold < min || threshold > keyHolderCount)
        {
            throw new BusinessException(DeathNoteErrorCodes.InvalidThreshold)
                .WithData("Min", min).WithData("Max", Math.Max(1, keyHolderCount));
        }
        Threshold = threshold;
        KeyHolderCount = keyHolderCount;
        WrappedReleaseKey = Check.NotNullOrWhiteSpace(wrappedReleaseKey, nameof(wrappedReleaseKey));
        EncryptedAllocation = encryptedAllocation;
        KeyVersion++;
        KeysDistributedAt = now;
        KeysOutdated = false;
    }

    public void MarkKeysOutdated()
    {
        if (KeysDistributedAt.HasValue) KeysOutdated = true;
    }

    public bool HasKeyDistribution => Threshold.HasValue && KeysDistributedAt.HasValue;
}
