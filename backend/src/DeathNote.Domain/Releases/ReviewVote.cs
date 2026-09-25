using Volo.Abp.Domain.Entities;

namespace DeathNote.Releases;

/// <summary>Một phiếu thẩm định của nhân sự PICO (bất biến sau khi tạo).</summary>
public class ReviewVote : Entity<Guid>
{
    public Guid ReleaseRequestId { get; private set; }
    public Guid AdminUserId { get; private set; }
    public string AdminName { get; private set; } = default!;
    public int Round { get; private set; }
    /// <summary>1 = phiếu thẩm định (Reviewer), 2 = phiếu phê duyệt (Approver).</summary>
    public int Stage { get; private set; }
    public ReviewDecision Decision { get; private set; }
    public string? Note { get; private set; }
    public DateTime VotedAt { get; private set; }

    protected ReviewVote() { }

    internal ReviewVote(Guid id, Guid requestId, Guid adminUserId, string adminName, int round, int stage,
        ReviewDecision decision, string? note, DateTime at) : base(id)
    {
        ReleaseRequestId = requestId;
        AdminUserId = adminUserId;
        AdminName = adminName;
        Round = round;
        Stage = stage;
        Decision = decision;
        Note = note;
        VotedAt = at;
    }
}
