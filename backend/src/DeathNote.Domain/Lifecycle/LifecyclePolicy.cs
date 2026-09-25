using Microsoft.Extensions.Options;
using Volo.Abp.DependencyInjection;

namespace DeathNote.Lifecycle;

/// <summary>
/// Bọc <see cref="LifecyclePolicyOptions"/> và quy đổi "ngày/giờ nghiệp vụ" ra <see cref="TimeSpan"/> thực,
/// có áp dụng hệ số nén thời gian cho demo. Mọi tính toán thời hạn trong domain PHẢI đi qua lớp này.
/// </summary>
public class LifecyclePolicy : ISingletonDependency
{
    public LifecyclePolicyOptions Options { get; }

    public LifecyclePolicy(IOptions<LifecyclePolicyOptions> options) : this(options.Value) { }

    /// <summary>Constructor dùng trực tiếp trong unit test.</summary>
    public LifecyclePolicy(LifecyclePolicyOptions options)
    {
        Options = options;
        if (Options.TimeScale <= 0) Options.TimeScale = 1;
    }

    public TimeSpan Days(double days) => TimeSpan.FromDays(days / Options.TimeScale);
    public TimeSpan Hours(double hours) => TimeSpan.FromHours(hours / Options.TimeScale);

    /// <summary>Số vòng nhắc trong giai đoạn Missed (mỗi kênh một vòng).</summary>
    public int ReminderSteps => Math.Max(1, Options.ReminderChannels.Length);

    /// <summary>Khoảng cách giữa hai vòng nhắc liên tiếp.</summary>
    public TimeSpan ReminderInterval => Days((double)Options.MissedPhaseDays / ReminderSteps);

    public TimeSpan FinalWait => Hours(Options.FinalWaitHours);

    public bool IsDemoMode => Options.TimeScale > 1;
}
