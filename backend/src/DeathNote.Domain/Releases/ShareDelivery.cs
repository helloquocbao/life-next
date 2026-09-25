using Volo.Abp.Domain.Entities;

namespace DeathNote.Releases;

/// <summary>
/// Mảnh khoá của trustee A, được A mở trên thiết bị của mình rồi NIÊM PHONG LẠI bằng khoá công khai
/// của trustee B. Server giữ nhưng chỉ trao cho B SAU KHI yêu cầu ở trạng thái Released.
/// <para>
/// Nhờ vậy việc ghép khoá xảy ra trên thiết bị của trustee, và kể cả khi toàn bộ server bị chiếm quyền,
/// kẻ tấn công vẫn không có khoá riêng của B để mở.
/// </para>
/// </summary>
public class ShareDelivery : Entity<Guid>
{
    public Guid ReleaseRequestId { get; private set; }
    public Guid FromTrusteeId { get; private set; }
    public Guid ToTrusteeId { get; private set; }
    public string SealedShare { get; private set; } = default!;
    public DateTime CreatedAt { get; private set; }

    protected ShareDelivery() { }

    internal ShareDelivery(Guid id, Guid requestId, Guid from, Guid to, string sealedShare, DateTime at) : base(id)
    {
        ReleaseRequestId = requestId;
        FromTrusteeId = from;
        ToTrusteeId = to;
        SealedShare = sealedShare;
        CreatedAt = at;
    }
}
