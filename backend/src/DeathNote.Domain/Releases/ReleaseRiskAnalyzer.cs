using DeathNote.Lifecycle;
using DeathNote.Owners;
using DeathNote.Trustees;
using Volo.Abp.DependencyInjection;

namespace DeathNote.Releases;

/// <summary>
/// Tự động phát hiện dấu hiệu lạm dụng trên một yêu cầu mở vault, hiển thị ở khối "Cờ rủi ro"
/// của màn hình thẩm định. Đây là lớp phòng thủ thứ hai sau cơ chế m-of-n.
/// </summary>
public class ReleaseRiskAnalyzer : ITransientDependency
{
    private readonly LifecyclePolicy _policy;

    public ReleaseRiskAnalyzer(LifecyclePolicy policy) => _policy = policy;

    public List<RiskFlag> Analyze(ReleaseRequest request, OwnerProfile owner, IReadOnlyCollection<Trustee> trustees)
    {
        var flags = new List<RiskFlag>();
        var byId = trustees.ToDictionary(t => t.Id);

        // 1) Nhiều người đồng thuận từ cùng một địa chỉ IP → có thể một người giả danh nhiều trustee.
        foreach (var group in request.Consents.Where(c => !string.IsNullOrEmpty(c.IpAddress))
                     .GroupBy(c => c.IpAddress).Where(g => g.Count() > 1))
        {
            var names = string.Join(", ", group.Select(c => byId.TryGetValue(c.TrusteeId, out var t) ? t.DisplayName : "?"));
            flags.Add(new RiskFlag("SAME_IP", RiskSeverity.High,
                $"{group.Count()} người đồng thuận từ cùng IP {group.Key}: {names}."));
        }

        // 2) Trustee mới được thêm ngay trước khi có yêu cầu mở.
        var window = _policy.Days(_policy.Options.NewTrusteeRiskDays);
        var involved = request.Consents.Select(c => c.TrusteeId).Append(request.InitiatorTrusteeId).Distinct();
        foreach (var id in involved)
        {
            if (byId.TryGetValue(id, out var t) && request.InitiatedAt - t.CreationTime < window)
            {
                flags.Add(new RiskFlag("NEW_TRUSTEE", RiskSeverity.Medium,
                    $"{t.DisplayName} được thêm làm người uỷ quyền chỉ {(request.InitiatedAt - t.CreationTime).TotalHours:0} giờ trước yêu cầu."));
            }
        }

        // 3) Có trustee báo "vẫn liên lạc được" với owner sau lần check-in cuối.
        var reachable = trustees.Where(t => t.LastContactResponse == ContactResponse.CanReach
                                            && t.LastContactResponseAt > owner.LastCheckInAt).ToList();
        if (reachable.Count > 0)
        {
            flags.Add(new RiskFlag("REPORTED_REACHABLE", RiskSeverity.High,
                $"{string.Join(", ", reachable.Select(t => t.DisplayName))} báo vẫn liên lạc được với owner."));
        }

        // 4) Owner vừa đổi email/số điện thoại ngay trước khi im lặng → có thể bị chiếm tài khoản liên lạc.
        if (owner.ContactInfoChangedAt is { } changed && owner.LastCheckInAt is { } last && last - changed < window)
        {
            flags.Add(new RiskFlag("CONTACT_CHANGED", RiskSeverity.Medium,
                "Thông tin liên hệ của owner bị thay đổi ngay trước lần check-in cuối."));
        }

        // 5) Chưa có bằng chứng bên ngoài.
        if (!request.Evidence.Any())
        {
            flags.Add(new RiskFlag("NO_EVIDENCE", RiskSeverity.High, "Chưa có tài liệu bằng chứng nào được nộp."));
        }

        // 6) Lý do "đã mất" nhưng không có giấy chứng tử.
        if (request.Reason == ReleaseReason.Deceased && request.Evidence.All(e => e.Kind != EvidenceKind.DeathCertificate))
        {
            flags.Add(new RiskFlag("MISSING_DEATH_CERT", RiskSeverity.Medium,
                "Lý do khai là đã mất nhưng chưa có giấy chứng tử."));
        }

        return flags;
    }
}
