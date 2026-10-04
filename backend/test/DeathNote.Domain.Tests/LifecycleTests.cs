using DeathNote.Lifecycle;
using DeathNote.Owners;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace DeathNote;

/// <summary>
/// Kiểm thử state machine vòng đời — chứng minh nguyên tắc "không heartbeat ≠ đã mất"
/// và "owner luôn có quyền phủ quyết".
/// </summary>
public class LifecycleTests
{
    private static readonly LifecyclePolicy Policy = new(new LifecyclePolicyOptions
    {
        MissedPhaseDays = 8,
        ReminderChannels = ["push", "email", "sms", "call"], // 4 vòng, mỗi vòng cách 2 ngày
        TimeScale = 1
    });

    private static readonly DateTime T0 = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    private static OwnerProfile NewOwner(int interval = 7, int grace = 7) =>
        new(Guid.NewGuid(), "An", "an@example.com", null, interval, grace, T0, Policy);

    [Fact]
    public void New_owner_is_active_and_due_after_interval()
    {
        var o = NewOwner(interval: 30);
        o.State.ShouldBe(LifecycleState.Active);
        o.NextCheckInDueAt.ShouldBe(T0.AddDays(30));
    }

    [Theory]
    [InlineData(10)]
    [InlineData(365)]
    public void Only_allowed_intervals_are_accepted(int interval)
    {
        Should.Throw<BusinessException>(() => NewOwner(interval: interval)).Code.ShouldBe(DeathNoteErrorCodes.InvalidCheckInInterval);
    }

    [Fact]
    public void Silence_escalates_Active_to_Missed_to_Grace_but_state_never_jumps_by_itself()
    {
        var o = NewOwner();
        var now = T0.AddDays(7);
        o.IsCheckInOverdue(now).ShouldBeTrue();
        o.MarkMissed(now);

        // 4 vòng nhắc, mỗi vòng cách 2 ngày
        for (var i = 0; i < 4; i++)
        {
            o.GetDueReminderStep(now, Policy).ShouldBe(i);
            o.RegisterReminderSent(now);
            o.GetDueReminderStep(now, Policy).ShouldBeNull();
            o.ShouldEnterGrace(now, Policy).ShouldBeFalse();
            now = now.AddDays(2);
        }

        o.ShouldEnterGrace(now, Policy).ShouldBeTrue();
        o.EnterGrace(now);
        o.State.ShouldBe(LifecycleState.Grace);

        // Bản thân OwnerProfile không tự đổi trạng thái theo thời gian: hết ân hạn chỉ làm "đủ điều kiện bàn giao",
        // còn việc chuyển sang Released do LifecycleManager gọi một cách có chủ đích.
        o.ShouldReleaseAutomatically(now.AddDays(1), Policy).ShouldBeFalse(); // còn trong ân hạn
        o.ShouldReleaseAutomatically(now.AddDays(365), Policy).ShouldBeTrue();
        o.State.ShouldBe(LifecycleState.Grace);
    }

    [Fact]
    public void Automatic_release_only_happens_from_grace_after_the_grace_period()
    {
        var o = DriveTo(LifecycleState.Grace);
        var end = o.GraceEndsAt(Policy)!.Value;
        o.ShouldReleaseAutomatically(end.AddMinutes(-1), Policy).ShouldBeFalse();
        o.ShouldReleaseAutomatically(end, Policy).ShouldBeTrue();

        o.ReleaseAutomatically(end);
        o.State.ShouldBe(LifecycleState.Released);
        o.ShouldReleaseAutomatically(end.AddDays(1), Policy).ShouldBeFalse();
        Should.Throw<BusinessException>(() => o.CheckIn(end.AddDays(1), Policy)).Code.ShouldBe(DeathNoteErrorCodes.AlreadyReleased);
    }

    [Theory]
    [InlineData(LifecycleState.Active)]
    [InlineData(LifecycleState.Missed)]
    public void Cannot_release_automatically_before_grace(LifecycleState target)
    {
        var o = DriveTo(target);
        o.ShouldReleaseAutomatically(T0.AddDays(1000), Policy).ShouldBeFalse();
        Should.Throw<BusinessException>(() => o.ReleaseAutomatically(T0.AddDays(1000))).Code.ShouldBe(DeathNoteErrorCodes.ReleaseNotAllowedInState);
    }

    [Theory]
    [InlineData(LifecycleState.Missed)]
    [InlineData(LifecycleState.Grace)]
    [InlineData(LifecycleState.Verifying)]
    [InlineData(LifecycleState.Review)]
    [InlineData(LifecycleState.FinalWait)]
    public void Check_in_is_a_veto_from_any_state_before_release(LifecycleState target)
    {
        var o = DriveTo(target);
        var previous = o.CheckIn(T0.AddDays(100), Policy);
        previous.ShouldBe(target);
        o.State.ShouldBe(LifecycleState.Active);
        o.RemindersSent.ShouldBe(0);
        o.GraceStartedAt.ShouldBeNull();
    }

    [Fact]
    public void Released_is_terminal()
    {
        var o = DriveTo(LifecycleState.FinalWait);
        o.MarkReleased(T0.AddDays(100));
        Should.Throw<BusinessException>(() => o.CheckIn(T0.AddDays(101), Policy)).Code.ShouldBe(DeathNoteErrorCodes.AlreadyReleased);
    }

    [Fact]
    public void Cannot_skip_states()
    {
        var o = NewOwner();
        Should.Throw<BusinessException>(() => o.EnterVerifying(T0));
        Should.Throw<BusinessException>(() => o.MarkReleased(T0));
    }

    [Fact]
    public void Pause_is_time_limited()
    {
        var o = NewOwner();
        Should.Throw<BusinessException>(() => o.Pause(T0.AddDays(400), "đi xa", T0, Policy));
        o.Pause(T0.AddDays(20), "du lịch", T0, Policy);
        o.IsCheckInOverdue(T0.AddDays(10)).ShouldBeFalse();
        o.NextCheckInDueAt.ShouldBeGreaterThan(T0.AddDays(20));
    }

    [Fact]
    public void Time_scale_compresses_durations_for_demo()
    {
        var demo = new LifecyclePolicy(new LifecyclePolicyOptions { TimeScale = 2880 });
        demo.Days(1).ShouldBe(TimeSpan.FromSeconds(30));
    }

    internal static OwnerProfile DriveTo(LifecycleState target)
    {
        var o = NewOwner();
        var now = T0.AddDays(7);
        if (target == LifecycleState.Active) return o;
        o.MarkMissed(now);
        if (target == LifecycleState.Missed) return o;
        for (var i = 0; i < 4; i++) { o.RegisterReminderSent(now); now = now.AddDays(2); }
        o.EnterGrace(now);
        if (target == LifecycleState.Grace) return o;
        o.EnterVerifying(now.AddDays(8));
        if (target == LifecycleState.Verifying) return o;
        o.EnterReview(now.AddDays(9));
        if (target == LifecycleState.Review) return o;
        o.EnterFinalWait(now.AddDays(10));
        return o;
    }
}
