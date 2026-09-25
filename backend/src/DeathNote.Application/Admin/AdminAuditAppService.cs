using DeathNote.AuditTrail;
using DeathNote.Common;
using DeathNote.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Domain.Repositories;

namespace DeathNote.Admin;

/// <summary>Audit log toàn hệ thống (append-only, xuất được) + kiểm tra toàn vẹn chuỗi băm cho kiểm toán bên thứ ba.</summary>
[Authorize(DeathNotePermissions.AuditLog)]
public class AdminAuditAppService : DeathNoteAppService, IAdminAuditAppService
{
    private readonly IRepository<AuditEvent, Guid> _events;
    private readonly AuditTrailManager _trail;

    public AdminAuditAppService(IRepository<AuditEvent, Guid> events, AuditTrailManager trail)
    {
        _events = events;
        _trail = trail;
    }

    public async Task<PagedResultDto<AuditEventDto>> GetListAsync(GetAuditLogInput input)
    {
        var query = await _events.GetQueryableAsync();
        if (input.OwnerId.HasValue) query = query.Where(e => e.OwnerId == input.OwnerId);
        if (!string.IsNullOrWhiteSpace(input.Action)) query = query.Where(e => e.Action.StartsWith(input.Action));
        var total = await AsyncExecuter.LongCountAsync(query);
        var page = await AsyncExecuter.ToListAsync(query.OrderByDescending(e => e.Sequence).Skip(input.SkipCount).Take(input.MaxResultCount));
        return new PagedResultDto<AuditEventDto>(total, page.Select(e => e.ToDto()).ToList());
    }

    public async Task<ChainVerificationDto> VerifyChainAsync()
    {
        var (total, broken) = await _trail.VerifyChainAsync();
        return new ChainVerificationDto
        {
            TotalEvents = total,
            IsIntact = broken == null,
            FirstBrokenSequence = broken,
            CheckedAt = Clock.Now
        };
    }
}
