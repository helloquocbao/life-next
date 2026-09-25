using DeathNote.Infrastructure;
using DeathNote.Notifications;
using Microsoft.Extensions.Options;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Timing;

namespace DeathNote;

/// <summary>Đồng hồ giả: test "tua nhanh" thời gian thay vì chờ thật.</summary>
public class FakeClock : Clock
{
    public static DateTime Current { get; set; } = new(2026, 1, 1, 8, 0, 0, DateTimeKind.Utc);

    public FakeClock(IOptions<AbpClockOptions> options, ICurrentTimezoneProvider currentTimezoneProvider, ITimezoneProvider timezoneProvider)
        : base(options, currentTimezoneProvider, timezoneProvider) { }

    public override DateTime Now => Current;

    public static void Advance(TimeSpan by) => Current = Current.Add(by);
}

/// <summary>IP giả lập cho từng "thiết bị" — kiểm tra luật chống đồng thuận trùng IP.</summary>
public class FakeRequestContext : IRequestContext
{
    public static string? CurrentIp { get; set; } = "10.0.0.1";
    public string? IpAddress => CurrentIp;
    public string? UserAgent => "IntegrationTest/1.0";
}

/// <summary>Bắt mọi thông báo đã gửi (để lấy link mời trustee và kiểm tra ai được báo).</summary>
public class CapturingNotificationSender : INotificationSender, ISingletonDependency
{
    public List<NotificationMessage> Sent { get; } = new();

    public Task SendAsync(NotificationMessage message)
    {
        lock (Sent) Sent.Add(message);
        return Task.CompletedTask;
    }
}
