using DeathNote.Releases;
using DeathNote.Vaults;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace DeathNote;

/// <summary>Kiểm thử quy trình mở vault: m-of-n, chống trùng IP, quy tắc 4 mắt, thời gian chờ cuối.</summary>
public class ReleaseRequestTests
{
    private static readonly DateTime T0 = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly (Guid, string)[] NoDeliveries = [];

    private static ReleaseRequest NewRequest(int m = 2) =>
        new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), ReleaseReason.Deceased, "khai báo", m, 1, T0);

    [Fact]
    public void Needs_m_distinct_consents_before_review()
    {
        var r = NewRequest(m: 2);
        r.AddConsent(Guid.NewGuid(), Guid.NewGuid(), "1.1.1.1", null, null, NoDeliveries, T0, true).ShouldBeFalse();
        r.Status.ShouldBe(ReleaseStatus.AwaitingConsent);
        r.AddConsent(Guid.NewGuid(), Guid.NewGuid(), "2.2.2.2", null, null, NoDeliveries, T0, true).ShouldBeTrue();
        r.Status.ShouldBe(ReleaseStatus.AwaitingFirstReview);
    }

    [Fact]
    public void Consents_from_same_ip_count_once()
    {
        var r = NewRequest(m: 2);
        r.AddConsent(Guid.NewGuid(), Guid.NewGuid(), "1.1.1.1", null, null, NoDeliveries, T0, true);
        r.AddConsent(Guid.NewGuid(), Guid.NewGuid(), "1.1.1.1", null, null, NoDeliveries, T0, true).ShouldBeFalse();
        r.EffectiveConsentCount(true).ShouldBe(1);
        r.Status.ShouldBe(ReleaseStatus.AwaitingConsent);
    }

    [Fact]
    public void Same_trustee_cannot_consent_twice()
    {
        var r = NewRequest(m: 3);
        var t = Guid.NewGuid();
        r.AddConsent(Guid.NewGuid(), t, "1.1.1.1", null, null, NoDeliveries, T0, true);
        Should.Throw<BusinessException>(() => r.AddConsent(Guid.NewGuid(), t, "9.9.9.9", null, null, NoDeliveries, T0, true))
            .Code.ShouldBe(DeathNoteErrorCodes.AlreadyConsented);
    }

    [Fact]
    public void Two_person_rule_and_final_wait()
    {
        var r = ReadyForReview();
        var reviewer = Guid.NewGuid();
        r.CastVote(Guid.NewGuid(), reviewer, "Reviewer", ReviewDecision.Approve, null, T0, TimeSpan.FromHours(72));
        r.Status.ShouldBe(ReleaseStatus.AwaitingSecondReview);

        // Cùng một người không được bỏ phiếu thứ hai
        Should.Throw<BusinessException>(() =>
            r.CastVote(Guid.NewGuid(), reviewer, "Reviewer", ReviewDecision.Approve, null, T0, TimeSpan.FromHours(72)))
            .Code.ShouldBe(DeathNoteErrorCodes.SameAdminCannotVoteTwice);

        r.CastVote(Guid.NewGuid(), Guid.NewGuid(), "Approver", ReviewDecision.Approve, null, T0, TimeSpan.FromHours(72));
        r.Status.ShouldBe(ReleaseStatus.FinalWait);
        r.FinalWaitUntil.ShouldBe(T0.AddHours(72));

        // Chưa hết thời gian chờ cuối → không phát hành được
        Should.Throw<BusinessException>(() => r.Complete(T0.AddHours(71)));
        r.Complete(T0.AddHours(72));
        r.Status.ShouldBe(ReleaseStatus.Released);
    }

    [Fact]
    public void Owner_can_cancel_even_during_final_wait()
    {
        var r = ReadyForReview();
        r.CastVote(Guid.NewGuid(), Guid.NewGuid(), "A", ReviewDecision.Approve, null, T0, TimeSpan.FromHours(72));
        r.CastVote(Guid.NewGuid(), Guid.NewGuid(), "B", ReviewDecision.Approve, null, T0, TimeSpan.FromHours(72));
        r.CancelByOwner(T0.AddHours(1));
        r.Status.ShouldBe(ReleaseStatus.CancelledByOwner);
        Should.Throw<BusinessException>(() => r.Complete(T0.AddHours(100)));
    }

    [Fact]
    public void Request_more_info_starts_a_new_round()
    {
        var r = ReadyForReview();
        var reviewer = Guid.NewGuid();
        r.CastVote(Guid.NewGuid(), reviewer, "R", ReviewDecision.RequestMoreInfo, "Thiếu giấy chứng tử", T0, TimeSpan.Zero);
        r.Status.ShouldBe(ReleaseStatus.NeedsMoreInfo);
        r.ResubmitForReview(T0.AddDays(1));
        r.ReviewRound.ShouldBe(2);
        // Vòng mới: người duyệt cũ được bỏ phiếu lại
        r.CastVote(Guid.NewGuid(), reviewer, "R", ReviewDecision.Approve, null, T0.AddDays(1), TimeSpan.Zero);
        r.Status.ShouldBe(ReleaseStatus.AwaitingSecondReview);
    }

    [Fact]
    public void Vault_key_distribution_bumps_version_and_clears_outdated_flag()
    {
        var v = new Vault(Guid.NewGuid(), "salt", 3, 1 << 26, "wrapped", "recovery", "rsalt");
        v.HasKeyDistribution.ShouldBeFalse();
        v.MarkKeysOutdated();
        v.KeysOutdated.ShouldBeFalse(); // chưa từng phân bổ nên chưa có gì "lỗi thời"

        v.RegisterKeyDistribution("enc-allocation", T0);
        v.KeyVersion.ShouldBe(1);
        v.HasKeyDistribution.ShouldBeTrue();

        v.MarkKeysOutdated();
        v.KeysOutdated.ShouldBeTrue();
        v.RegisterKeyDistribution("enc-allocation-2", T0.AddDays(1));
        v.KeyVersion.ShouldBe(2);
        v.KeysOutdated.ShouldBeFalse();
    }

    private static ReleaseRequest ReadyForReview()
    {
        var r = NewRequest(m: 2);
        r.AddConsent(Guid.NewGuid(), Guid.NewGuid(), "1.1.1.1", null, null, NoDeliveries, T0, true);
        r.AddConsent(Guid.NewGuid(), Guid.NewGuid(), "2.2.2.2", null, null, NoDeliveries, T0, true);
        return r;
    }
}
