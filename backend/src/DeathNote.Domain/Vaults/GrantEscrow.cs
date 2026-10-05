using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Volo.Abp.DependencyInjection;

namespace DeathNote.Vaults;

/// <summary>
/// Giữ hộ "khoá giao hàng" (delivery key) của từng người nhận cho tới khi hồ sơ được bàn giao.
/// <para>
/// Người nhận mặc định KHÔNG biết gì và không tạo khoá cá nhân từ trước. Vì vậy phần dành cho họ
/// (<see cref="Grant"/>) được owner mã hoá bằng một khoá ngẫu nhiên riêng cho từng người; khoá đó được server giữ
/// (mã hoá bằng khoá chủ <c>DeathNote:EscrowKey</c> nằm ở cấu hình máy chủ, KHÔNG nằm trong CSDL) và chỉ trao ra khi
/// owner ở trạng thái Released, cho đúng người nhận đã xác thực bằng link trong email.
/// </para>
/// <para>
/// <b>Đánh đổi bảo mật:</b> khác với cách "khoá bằng khoá riêng của người nhận" trước đây, ai kiểm soát cả CSDL lẫn cấu hình
/// máy chủ có thể giải mã phần đã phân cho người nhận (không phải toàn bộ két). Vì vậy <c>EscrowKey</c> phải được giữ bí mật
/// và đặt riêng cho từng môi trường.
/// </para>
/// </summary>
public class GrantEscrow : ITransientDependency
{
    private readonly byte[] _key;

    public GrantEscrow(IConfiguration configuration)
    {
        var secret = configuration["DeathNote:EscrowKey"];
        if (string.IsNullOrWhiteSpace(secret) || secret.Length < 32)
            throw new InvalidOperationException("Cần cấu hình DeathNote:EscrowKey (≥ 32 ký tự).");
        _key = SHA256.HashData(Encoding.UTF8.GetBytes(secret));
    }

    /// <summary>Mã hoá khoá giao hàng (base64) để lưu CSDL. Gắn với trusteeId để không đem sang người khác được.</summary>
    public string Protect(string deliveryKeyB64, Guid trusteeId)
    {
        var plain = Convert.FromBase64String(deliveryKeyB64);
        var nonce = RandomNumberGenerator.GetBytes(12);
        var cipher = new byte[plain.Length];
        var tag = new byte[16];
        using var aes = new AesGcm(_key, 16);
        aes.Encrypt(nonce, plain, cipher, tag, trusteeId.ToByteArray());
        return Convert.ToBase64String([.. nonce, .. tag, .. cipher]);
    }

    public string Unprotect(string protectedB64, Guid trusteeId)
    {
        var all = Convert.FromBase64String(protectedB64);
        var nonce = all[..12];
        var tag = all[12..28];
        var cipher = all[28..];
        var plain = new byte[cipher.Length];
        using var aes = new AesGcm(_key, 16);
        aes.Decrypt(nonce, cipher, tag, plain, trusteeId.ToByteArray());
        return Convert.ToBase64String(plain);
    }
}
