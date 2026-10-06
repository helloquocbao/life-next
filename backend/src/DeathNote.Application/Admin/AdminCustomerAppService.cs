using DeathNote.AuditTrail;
using DeathNote.Owners;
using DeathNote.Permissions;
using DeathNote.Trustees;
using DeathNote.Vaults;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Domain.Repositories;

namespace DeathNote.Admin;

/// <summary>
/// Danh sách khách hàng (owner đã hoàn tất thiết lập) cho đội vận hành: trạng thái vòng đời, số người được uỷ quyền,
/// số hạng mục két. Email & SĐT luôn bị che trong danh sách; người có quyền <c>Customers.ViewContact</c> xem đầy đủ
/// từng khách hàng qua <see cref="GetContactAsync"/> (mỗi lần xem ghi vào audit của khách hàng đó).
/// KHÔNG có API nào trả nội dung két (zero-knowledge).
/// </summary>
[Authorize(DeathNotePermissions.Customers.Default)]
public class AdminCustomerAppService : DeathNoteAppService, IAdminCustomerAppService
{
    private readonly IRepository<OwnerProfile, Guid> _owners;
    private readonly IRepository<Trustee, Guid> _trustees;
    private readonly IRepository<VaultItem, Guid> _items;

    public AdminCustomerAppService(IRepository<OwnerProfile, Guid> owners, IRepository<Trustee, Guid> trustees, IRepository<VaultItem, Guid> items)
    {
        _owners = owners;
        _trustees = trustees;
        _items = items;
    }

    public async Task<PagedResultDto<CustomerDto>> GetListAsync(GetCustomersInput input)
    {
        var query = await _owners.GetQueryableAsync();
        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            var f = input.Filter.Trim().ToLower();
            query = query.Where(o => o.DisplayName.ToLower().Contains(f) || o.Email.ToLower().Contains(f)
                                     || (o.PhoneNumber != null && o.PhoneNumber.Contains(f)));
        }
        if (input.State.HasValue) query = query.Where(o => o.State == input.State);

        var total = await AsyncExecuter.LongCountAsync(query);
        var page = await AsyncExecuter.ToListAsync(query.OrderByDescending(o => o.CreationTime)
            .Skip(input.SkipCount).Take(input.MaxResultCount));

        // Đếm theo lô cho đúng các owner trong trang (2 query thay vì 2×N).
        var ids = page.Select(o => o.Id).ToList();
        var trusteeCounts = (await AsyncExecuter.ToListAsync((await _trustees.GetQueryableAsync())
                .Where(t => ids.Contains(t.OwnerId)).GroupBy(t => t.OwnerId).Select(g => new { g.Key, Count = g.Count() })))
            .ToDictionary(x => x.Key, x => x.Count);
        var itemCounts = (await AsyncExecuter.ToListAsync((await _items.GetQueryableAsync())
                .Where(i => ids.Contains(i.OwnerId)).GroupBy(i => i.OwnerId).Select(g => new { g.Key, Count = g.Count() })))
            .ToDictionary(x => x.Key, x => x.Count);

        return new PagedResultDto<CustomerDto>(total, page.Select(o => new CustomerDto
        {
            Id = o.Id,
            DisplayName = o.DisplayName,
            MaskedEmail = ContactMasker.Email(o.Email),
            MaskedPhoneNumber = ContactMasker.Phone(o.PhoneNumber),
            State = o.State,
            StateChangedAt = o.StateChangedAt,
            LastCheckInAt = o.LastCheckInAt,
            NextCheckInDueAt = o.NextCheckInDueAt,
            CheckInIntervalDays = o.CheckInIntervalDays,
            GraceDays = o.GraceDays,
            PausedUntil = o.IsPaused(Clock.Now) ? o.PausedUntil : null,
            TrusteeCount = trusteeCounts.GetValueOrDefault(o.Id),
            VaultItemCount = itemCounts.GetValueOrDefault(o.Id),
            CreationTime = o.CreationTime
        }).ToList());
    }

    [Authorize(DeathNotePermissions.Customers.ViewContact)]
    public async Task<CustomerContactDto> GetContactAsync(Guid id)
    {
        var owner = await _owners.GetAsync(id);
        await Audit.RecordAsync(new AuditEntry(AuditActions.CustomerContactViewed, owner.Id, ActorType: AuditActorType.Admin,
            ActorUserId: UserId, ActorName: CurrentUserDisplayName, Detail: "Xem email & số điện thoại"));
        return new CustomerContactDto { Email = owner.Email, PhoneNumber = owner.PhoneNumber };
    }
}
