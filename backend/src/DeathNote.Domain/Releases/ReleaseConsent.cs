using Volo.Abp.Domain.Entities;

namespace DeathNote.Releases;

/// <summary>
/// Một phiếu đồng thuận của người giữ khoá. Lưu IP/thiết bị để thẩm định viên
/// phát hiện trường hợp nhiều "trustee" thực chất là một người.
/// </summary>
public class ReleaseConsent : Entity<Guid>
{
    public Guid ReleaseRequestId { get; private set; }
    public Guid TrusteeId { get; private set; }
    public DateTime ConsentedAt { get; private set; }
    public string? IpAddress { get; private set; }
    public string? UserAgent { get; private set; }
    public string? Statement { get; private set; }

    protected ReleaseConsent() { }

    internal ReleaseConsent(Guid id, Guid requestId, Guid trusteeId, DateTime at, string? ip, string? userAgent, string? statement)
        : base(id)
    {
        ReleaseRequestId = requestId;
        TrusteeId = trusteeId;
        ConsentedAt = at;
        IpAddress = ip;
        UserAgent = userAgent?.Length > 512 ? userAgent[..512] : userAgent;
        Statement = statement?.Length > 2000 ? statement[..2000] : statement;
    }
}
