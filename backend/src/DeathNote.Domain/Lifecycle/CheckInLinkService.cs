using System.Security.Cryptography;
using System.Text;
using DeathNote.Owners;
using Microsoft.Extensions.Configuration;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Timing;

namespace DeathNote.Lifecycle;

/// <summary>
/// Tạo và kiểm tra link check-in một chạm gửi qua email/SMS
/// (nguyên tắc: "check-in phải xác nhận được qua SMS hoặc email mà không cần mở app").
/// <para>
/// Token = base64url(ownerId | nonce | hạn dùng) + "." + HMAC-SHA256. Token chỉ hợp lệ khi nonce khớp
/// <see cref="OwnerProfile.CheckInLinkNonce"/> hiện tại ⇒ mỗi link chỉ dùng được một lần và tự hết hiệu lực
/// khi có lần nhắc mới.
/// </para>
/// </summary>
public class CheckInLinkService : ITransientDependency
{
    private readonly byte[] _secret;
    private readonly IClock _clock;
    private readonly LifecyclePolicy _policy;

    public CheckInLinkService(IConfiguration configuration, IClock clock, LifecyclePolicy policy)
    {
        var secret = configuration["DeathNote:CheckInLinkSecret"];
        if (string.IsNullOrWhiteSpace(secret) || secret.Length < 32)
            throw new InvalidOperationException("Cần cấu hình DeathNote:CheckInLinkSecret (≥ 32 ký tự).");
        _secret = Encoding.UTF8.GetBytes(secret);
        _clock = clock;
        _policy = policy;
    }

    public string CreateToken(OwnerProfile owner)
    {
        var expires = _clock.Now + _policy.Days(owner.CheckInIntervalDays + _policy.Options.MissedPhaseDays);
        var payload = $"{owner.Id:N}|{owner.CheckInLinkNonce}|{new DateTimeOffset(expires, TimeSpan.Zero).ToUnixTimeSeconds()}";
        var payloadPart = B64(Encoding.UTF8.GetBytes(payload));
        return payloadPart + "." + B64(HMACSHA256.HashData(_secret, Encoding.ASCII.GetBytes(payloadPart)));
    }

    /// <summary>Giải mã token; trả về (ownerId, nonce) nếu chữ ký hợp lệ và chưa hết hạn, ngược lại null.</summary>
    public (Guid OwnerId, string Nonce)? Validate(string token)
    {
        var parts = token.Split('.');
        if (parts.Length != 2) return null;
        var expected = HMACSHA256.HashData(_secret, Encoding.ASCII.GetBytes(parts[0]));
        byte[] actual;
        try { actual = FromB64(parts[1]); } catch { return null; }
        if (!CryptographicOperations.FixedTimeEquals(expected, actual)) return null;

        var fields = Encoding.UTF8.GetString(FromB64(parts[0])).Split('|');
        if (fields.Length != 3 || !Guid.TryParse(fields[0], out var ownerId) || !long.TryParse(fields[2], out var exp)) return null;
        if (DateTimeOffset.FromUnixTimeSeconds(exp).UtcDateTime < _clock.Now) return null;
        return (ownerId, fields[1]);
    }

    private static string B64(byte[] b) => Convert.ToBase64String(b).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] FromB64(string s)
    {
        s = s.Replace('-', '+').Replace('_', '/');
        return Convert.FromBase64String(s.PadRight(s.Length + (4 - s.Length % 4) % 4, '='));
    }
}
