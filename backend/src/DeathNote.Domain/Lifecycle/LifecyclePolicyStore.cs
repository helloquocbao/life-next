using System.Text.Json;
using DeathNote.Settings;
using Volo.Abp;
using Volo.Abp.DependencyInjection;
using Volo.Abp.SettingManagement;

namespace DeathNote.Lifecycle;

/// <summary>Các tham số chính sách admin được chỉnh trực tiếp trên console.</summary>
public record EditablePolicy(int MissedPhaseDays, string[] ReminderChannels, int DefaultGraceDays,
    int MinGraceDays, int MaxGraceDays, int MaxPauseDays);

/// <summary>
/// Lưu chính sách admin đã chỉnh vào CSDL (setting toàn cục <see cref="DeathNoteSettings.Policy"/>) và áp lên
/// <see cref="LifecyclePolicy"/> singleton. Chưa ai chỉnh → giữ nguyên giá trị từ appsettings.
/// </summary>
public class LifecyclePolicyStore : ITransientDependency
{
    private readonly ISettingManager _settings;
    private readonly LifecyclePolicy _policy;

    public LifecyclePolicyStore(ISettingManager settings, LifecyclePolicy policy)
    {
        _settings = settings;
        _policy = policy;
    }

    /// <summary>Nạp bản đã lưu (nếu có) — gọi một lần khi host khởi động, sau khi migrate CSDL.</summary>
    public async Task LoadAsync()
    {
        var json = await _settings.GetOrNullGlobalAsync(DeathNoteSettings.Policy);
        if (string.IsNullOrWhiteSpace(json)) return;
        var saved = JsonSerializer.Deserialize<EditablePolicy>(json);
        if (saved != null) _policy.Apply(saved);
    }

    public async Task SaveAsync(EditablePolicy p)
    {
        Validate(p);
        await _settings.SetGlobalAsync(DeathNoteSettings.Policy, JsonSerializer.Serialize(p));
        _policy.Apply(p);
    }

    private static void Validate(EditablePolicy p)
    {
        if (p.MinGraceDays > p.MaxGraceDays || p.DefaultGraceDays < p.MinGraceDays || p.DefaultGraceDays > p.MaxGraceDays)
            throw new UserFriendlyException("Thời gian ân hạn phải thoả: tối thiểu ≤ mặc định ≤ tối đa.");
        if (p.ReminderChannels.Length == 0
            || p.ReminderChannels.Any(c => !LifecyclePolicyOptions.AvailableReminderChannels.Contains(c)))
            throw new UserFriendlyException("Kênh nhắc không hợp lệ.");
    }
}
