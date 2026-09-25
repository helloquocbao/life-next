using DeathNote.AuditTrail;

namespace DeathNote.Common;

/// <summary>Một dòng audit log hiển thị cho owner / trustee / admin.</summary>
public class AuditEventDto
{
    public long Sequence { get; set; }
    public DateTime OccurredAt { get; set; }
    public Guid? OwnerId { get; set; }
    public AuditActorType ActorType { get; set; }
    public string? ActorName { get; set; }
    public string Action { get; set; } = default!;
    public string? TargetType { get; set; }
    public string? TargetId { get; set; }
    public string? Detail { get; set; }
    public string? IpAddress { get; set; }
    public string Hash { get; set; } = default!;
}
