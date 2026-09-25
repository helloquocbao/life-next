using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace DeathNote.Trustees;

/// <summary>
/// Cặp khoá X25519 cá nhân của một người dùng khi đóng vai trò trustee.
/// <para>
/// Khoá riêng được sinh trên trình duyệt, bọc bằng passphrase của chính trustee (Argon2id)
/// rồi mới gửi lên — giúp trustee đăng nhập từ thiết bị bất kỳ mà server vẫn không đọc được khoá.
/// </para>
/// Id = Id tài khoản người dùng.
/// </summary>
public class UserKeyring : CreationAuditedAggregateRoot<Guid>
{
    public string PublicKey { get; private set; } = default!;
    public string EncryptedPrivateKey { get; private set; } = default!;
    public string KdfSalt { get; private set; } = default!;
    public long KdfOpsLimit { get; private set; }
    public long KdfMemLimit { get; private set; }
    public int CryptoVersion { get; private set; } = DeathNoteConsts.CryptoVersion;

    protected UserKeyring() { }

    public UserKeyring(Guid userId, string publicKey, string encryptedPrivateKey, string kdfSalt, long opsLimit, long memLimit)
        : base(userId)
    {
        PublicKey = Check.NotNullOrWhiteSpace(publicKey, nameof(publicKey));
        EncryptedPrivateKey = Check.NotNullOrWhiteSpace(encryptedPrivateKey, nameof(encryptedPrivateKey));
        KdfSalt = Check.NotNullOrWhiteSpace(kdfSalt, nameof(kdfSalt));
        KdfOpsLimit = opsLimit;
        KdfMemLimit = memLimit;
    }
}
