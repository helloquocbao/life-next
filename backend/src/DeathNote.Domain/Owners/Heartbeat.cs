using DeathNote.Lifecycle;
using Volo.Abp.Domain.Entities;

namespace DeathNote.Owners;

/// <summary>
/// Một lần owner xác nhận "tôi vẫn ổn". Lưu ở dạng rõ (không nhạy cảm) để vẽ timeline heartbeat
/// cho owner và cho thẩm định viên.
/// </summary>
public class Heartbeat : BasicAggregateRoot<Guid>
{
    public Guid OwnerId { get; private set; }
    public DateTime OccurredAt { get; private set; }
    public CheckInChannel Channel { get; private set; }
    public string? IpAddress { get; private set; }
    public string? UserAgent { get; private set; }
    /// <summary>Lần check-in này có huỷ một tiến trình cảnh báo/xác minh đang chạy không (quyền phủ quyết).</summary>
    public bool WasVeto { get; private set; }

    protected Heartbeat() { }

    public Heartbeat(Guid id, Guid ownerId, DateTime occurredAt, CheckInChannel channel, string? ip, string? userAgent, bool wasVeto)
        : base(id)
    {
        OwnerId = ownerId;
        OccurredAt = occurredAt;
        Channel = channel;
        IpAddress = ip;
        UserAgent = userAgent?.Length > 512 ? userAgent[..512] : userAgent;
        WasVeto = wasVeto;
    }
}
