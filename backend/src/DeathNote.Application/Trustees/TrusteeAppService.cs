using DeathNote.AuditTrail;
using DeathNote.Common;
using DeathNote.Owners;
using DeathNote.Vaults;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;

namespace DeathNote.Trustees;

/// <summary>Owner quản lý người nhắc nhở và người nhận thông tin: thêm, sửa vai trò, xoá, gửi lời mời.</summary>
[Authorize]
public class TrusteeAppService : DeathNoteAppService, ITrusteeAppService
{
    private readonly IRepository<Trustee, Guid> _trustees;
    private readonly IRepository<OwnerProfile, Guid> _owners;
    private readonly IRepository<Vault, Guid> _vaults;
    private readonly IRepository<Grant, Guid> _grants;
    private readonly TrusteeInvitationSender _invitationSender;

    public TrusteeAppService(IRepository<Trustee, Guid> trustees, IRepository<OwnerProfile, Guid> owners, IRepository<Vault, Guid> vaults,
        IRepository<Grant, Guid> grants, TrusteeInvitationSender invitationSender)
    {
        _trustees = trustees;
        _owners = owners;
        _vaults = vaults;
        _grants = grants;
        _invitationSender = invitationSender;
    }

    public async Task<List<TrusteeDto>> GetListAsync()
    {
        var vault = await _vaults.FindAsync(UserId);
        var version = vault?.KeyVersion ?? -1;
        var trustees = await _trustees.GetListAsync(t => t.OwnerId == UserId);
        var grants = await _grants.GetListAsync(g => g.OwnerId == UserId && g.KeyVersion == version);
        return trustees.OrderBy(t => t.CreationTime).Select(t =>
        {
            var grant = grants.FirstOrDefault(g => g.TrusteeId == t.Id);
            return t.ToDto(grant != null, grant?.ItemCount ?? 0);
        }).ToList();
    }

    /// <summary>
    /// Chỉ THÊM người được uỷ quyền — KHÔNG gửi lời mời ngay (owner không muốn họ biết trước).
    /// Lời mời chỉ được gửi khi owner chủ động bấm "Gửi lời mời ngay" (<see cref="ResendInvitationAsync"/>)
    /// hoặc tự động khi owner bị Missed (xem <see cref="DeathNote.Lifecycle.LifecycleManager"/>).
    /// </summary>
    public async Task<TrusteeDto> CreateAsync(SaveTrusteeInput input)
    {
        var owner = await GetOwnerAsync();
        if (string.Equals(input.Email.Trim(), owner.Email, StringComparison.OrdinalIgnoreCase))
            throw new BusinessException(DeathNoteErrorCodes.CannotBeOwnTrustee);

        var trustee = new Trustee(GuidGenerator.Create(), owner.Id, input.DisplayName, input.Email, input.PhoneNumber,
            input.Relationship, input.Role, Clock.Now);
        await _trustees.InsertAsync(trustee, autoSave: true);

        await Audit.RecordAsync(new AuditEntry(AuditActions.TrusteeAdded, owner.Id, trustee.Id, AuditActorType.Owner,
            owner.Id, owner.DisplayName, nameof(Trustee), trustee.Id.ToString(),
            trustee.Role == TrusteeRole.Reminder
                ? $"{trustee.DisplayName} — {trustee.Role} (chưa gửi lời mời, sẽ tự gửi khi owner bỏ lỡ xác nhận)"
                : $"{trustee.DisplayName} — {trustee.Role} (chưa gửi lời mời — cần mời để họ tạo khoá trước khi nhận được thông tin)"));
        return trustee.ToDto(false, 0);
    }

    public async Task<TrusteeDto> UpdateAsync(Guid id, SaveTrusteeInput input)
    {
        var trustee = await GetMyTrusteeAsync(id);
        var roleChanged = trustee.Role != input.Role;
        trustee.Update(input.DisplayName, input.Email, input.PhoneNumber, input.Relationship, input.Role);
        await _trustees.UpdateAsync(trustee);
        if (roleChanged)
        {
            // Người nhắc nhở không nhận thông tin nào — bỏ phần đã niêm phong cho họ (nếu trước đó là người nhận).
            if (trustee.Role == TrusteeRole.Reminder) await _grants.DeleteAsync(g => g.TrusteeId == id);
            await MarkKeysOutdatedAsync();
        }
        await Audit.RecordAsync(new AuditEntry(AuditActions.TrusteeUpdated, UserId, trustee.Id, AuditActorType.Owner,
            UserId, CurrentUserDisplayName, nameof(Trustee), id.ToString(), $"Vai trò: {trustee.Role}"));
        return trustee.ToDto(false, 0);
    }

    /// <summary>Xoá người được uỷ quyền: huỷ luôn phần (Grant) đã niêm phong cho họ.</summary>
    public async Task DeleteAsync(Guid id)
    {
        var trustee = await GetMyTrusteeAsync(id);
        await _grants.DeleteAsync(g => g.TrusteeId == id);
        await _trustees.DeleteAsync(trustee);
        await MarkKeysOutdatedAsync();
        await Audit.RecordAsync(new AuditEntry(AuditActions.TrusteeRemoved, UserId, trustee.Id, AuditActorType.Owner,
            UserId, CurrentUserDisplayName, nameof(Trustee), id.ToString(), trustee.DisplayName));
    }

    /// <summary>
    /// Gửi lời mời — dùng cho cả "gửi lời mời ngay" (trustee đang NotInvitedYet, owner chủ động chọn
    /// tiết lộ sớm cho người này) lẫn "gửi lại" (trustee đã từng mời nhưng chưa phản hồi).
    /// </summary>
    public async Task ResendInvitationAsync(Guid id)
    {
        var owner = await GetOwnerAsync();
        var trustee = await GetMyTrusteeAsync(id);
        await _invitationSender.SendAsync(owner, trustee, Clock.Now);
        await Audit.RecordAsync(new AuditEntry(AuditActions.TrusteeInvited, owner.Id, trustee.Id, AuditActorType.Owner,
            owner.Id, owner.DisplayName, nameof(Trustee), trustee.Id.ToString(), $"{trustee.DisplayName} — {trustee.Role} (owner chủ động gửi)"));
    }

    private async Task MarkKeysOutdatedAsync()
    {
        var vault = await _vaults.FindAsync(UserId);
        if (vault == null) return;
        vault.MarkKeysOutdated();
        await _vaults.UpdateAsync(vault);
    }

    private async Task<OwnerProfile> GetOwnerAsync() =>
        await _owners.FindAsync(UserId) ?? throw new BusinessException(DeathNoteErrorCodes.OnboardingRequired);

    private async Task<Trustee> GetMyTrusteeAsync(Guid id)
    {
        var t = await _trustees.FindAsync(id);
        if (t == null || t.OwnerId != UserId) throw new EntityNotFoundException(typeof(Trustee), id);
        return t;
    }
}
