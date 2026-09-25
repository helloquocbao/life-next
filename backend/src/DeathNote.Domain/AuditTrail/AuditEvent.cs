using System.Security.Cryptography;
using System.Text;
using Volo.Abp.Domain.Entities;

namespace DeathNote.AuditTrail;

/// <summary>
/// Một sự kiện trong audit log BẤT BIẾN (append-only) của sản phẩm.
/// <para><b>Ba lớp bảo vệ tính toàn vẹn:</b></para>
/// <list type="number">
/// <item>Không có phương thức sửa/xoá trong code (không setter công khai).</item>
/// <item>Trigger CSDL chặn mọi lệnh UPDATE/DELETE trên bảng (xem migration).</item>
/// <item>Chuỗi băm: mỗi bản ghi chứa SHA-256 của bản ghi trước ⇒ sửa một dòng bất kỳ sẽ làm gãy
/// toàn bộ chuỗi phía sau — kiểm tra được bởi bên thứ ba (admin console → "Kiểm tra toàn vẹn").</item>
/// </list>
/// Owner xem được toàn bộ log của mình; trustee xem log liên quan đến mình; admin xem toàn hệ thống.
/// </summary>
public class AuditEvent : BasicAggregateRoot<Guid>
{
    /// <summary>Số thứ tự tăng dần liên tục trong toàn hệ thống.</summary>
    public long Sequence { get; private set; }
    public DateTime OccurredAt { get; private set; }
    /// <summary>Hồ sơ owner liên quan (null với sự kiện hệ thống chung).</summary>
    public Guid? OwnerId { get; private set; }
    /// <summary>Trustee liên quan (để trustee lọc "log liên quan đến mình").</summary>
    public Guid? TrusteeId { get; private set; }
    public AuditActorType ActorType { get; private set; }
    public Guid? ActorUserId { get; private set; }
    public string? ActorName { get; private set; }
    public string Action { get; private set; } = default!;
    public string? TargetType { get; private set; }
    public string? TargetId { get; private set; }
    /// <summary>Mô tả ngắn, KHÔNG BAO GIỜ chứa nội dung vault.</summary>
    public string? Detail { get; private set; }
    public string? IpAddress { get; private set; }
    public string PreviousHash { get; private set; } = default!;
    public string Hash { get; private set; } = default!;

    protected AuditEvent() { }

    internal AuditEvent(Guid id, long sequence, DateTime occurredAt, string previousHash, AuditEntry e, string? ip) : base(id)
    {
        Sequence = sequence;
        // Làm tròn tới mili-giây để giá trị băm khớp sau khi đọc lại từ PostgreSQL (độ chính xác micro-giây).
        OccurredAt = new DateTime(occurredAt.Ticks - occurredAt.Ticks % TimeSpan.TicksPerMillisecond, DateTimeKind.Utc);
        OwnerId = e.OwnerId;
        TrusteeId = e.TrusteeId;
        ActorType = e.ActorType;
        ActorUserId = e.ActorUserId;
        ActorName = e.ActorName;
        Action = e.Action;
        TargetType = e.TargetType;
        TargetId = e.TargetId;
        Detail = e.Detail?.Length > 2000 ? e.Detail[..2000] : e.Detail;
        IpAddress = ip;
        PreviousHash = previousHash;
        Hash = ComputeHash();
    }

    /// <summary>Tính lại giá trị băm từ nội dung hiện tại — dùng khi kiểm tra toàn vẹn chuỗi.</summary>
    public string ComputeHash()
    {
        var canonical = string.Join('|',
            Sequence, PreviousHash, OccurredAt.ToString("yyyy-MM-ddTHH:mm:ss.fff"),
            OwnerId, TrusteeId, (int)ActorType, ActorUserId, ActorName, Action, TargetType, TargetId, Detail, IpAddress);
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical)));
    }

    /// <summary>Giá trị "băm trước" của bản ghi đầu tiên trong chuỗi.</summary>
    public const string GenesisHash = "0000000000000000000000000000000000000000000000000000000000000000";
}

/// <summary>Dữ liệu đầu vào để ghi một sự kiện audit.</summary>
public record AuditEntry(
    string Action,
    Guid? OwnerId = null,
    Guid? TrusteeId = null,
    AuditActorType ActorType = AuditActorType.System,
    Guid? ActorUserId = null,
    string? ActorName = null,
    string? TargetType = null,
    string? TargetId = null,
    string? Detail = null);
