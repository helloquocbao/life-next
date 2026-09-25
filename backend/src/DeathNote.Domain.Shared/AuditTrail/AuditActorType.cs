namespace DeathNote.AuditTrail;

/// <summary>Ai là tác nhân của một sự kiện audit.</summary>
public enum AuditActorType
{
    System = 0,
    Owner = 1,
    Trustee = 2,
    Admin = 3,
    Anonymous = 4
}
