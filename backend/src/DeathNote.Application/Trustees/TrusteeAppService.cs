using DeathNote.AuditTrail;
using DeathNote.Common;
using DeathNote.Infrastructure;
using DeathNote.Notifications;
using DeathNote.Owners;
using DeathNote.Vaults;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using Volo.Abp;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;

namespace DeathNote.Trustees;

/// <summary>Owner quản lý người được uỷ quyền: mời, sửa vai trò, xoá, gửi lại lời mời.</summary>
[Authorize]
public class TrusteeAppService : DeathNoteAppService, ITrusteeAppService
{
    private readonly IRepository<Trustee, Guid> _trustees;
    private readonly IRepository<OwnerProfile, Guid> _owners;
    private readonly IRepository<Vault, Guid> _vaults;
    private readonly IRepository<KeyShare, Guid> _keyShares;
    private readonly IRepository<Grant, Guid> _grants;
    private readonly INotificationSender _notifier;
    private readonly DeathNoteAppUrlOptions _urls;

    public TrusteeAppService(IRepository<Trustee, Guid> trustees, IRepository<OwnerProfile, Guid> owners, IRepository<Vault, Guid> vaults,
        IRepository<KeyShare, Guid> keyShares, IRepository<Grant, Guid> grants, INotificationSender notifier, IOptions<DeathNoteAppUrlOptions> urls)
    {
        _trustees = trustees;
        _owners = owners;
        _vaults = vaults;
        _keyShares = keyShares;
        _grants = grants;
        _notifier = notifier;
        _urls = urls.Value;
    }

    public async Task<List<TrusteeDto>> GetListAsync()
    {
        var vault = await _vaults.FindAsync(UserId);
        var version = vault?.KeyVersion ?? -1;
        var trustees = await _trustees.GetListAsync(t => t.OwnerId == UserId);
        var shares = await _keyShares.GetListAsync(k => k.OwnerId == UserId && k.KeyVersion == version);
        var grants = await _grants.GetListAsync(g => g.OwnerId == UserId && g.KeyVersion == version);
        return trustees.OrderBy(t => t.CreationTime).Select(t => t.ToDto(
            shares.Any(s => s.TrusteeId == t.Id),
            grants.FirstOrDefault(g => g.TrusteeId == t.Id)?.ItemCount ?? 0)).ToList();
    }

    public async Task<TrusteeDto> CreateAsync(SaveTrusteeInput input)
    {
        var owner = await GetOwnerAsync();
        if (string.Equals(input.Email.Trim(), owner.Email, StringComparison.OrdinalIgnoreCase))
            throw new BusinessException(DeathNoteErrorCodes.CannotBeOwnTrustee);

        var trustee = new Trustee(GuidGenerator.Create(), owner.Id, input.DisplayName, input.Email, input.PhoneNumber,
            input.Relationship, input.Role, Clock.Now);
        var token = trustee.IssueInvitationToken(Clock.Now);
        await _trustees.InsertAsync(trustee, autoSave: true);

        await SendInvitationAsync(owner, trustee, token);
        await Audit.RecordAsync(new AuditEntry(AuditActions.TrusteeInvited, owner.Id, trustee.Id, AuditActorType.Owner,
            owner.Id, owner.DisplayName, nameof(Trustee), trustee.Id.ToString(), $"{trustee.DisplayName} — {trustee.Role}"));
        return trustee.ToDto(false, 0);
    }

    public async Task<TrusteeDto> UpdateAsync(Guid id, SaveTrusteeInput input)
    {
        var trustee = await GetMyTrusteeAsync(id);
        var roleChanged = trustee.Role != input.Role;
        trustee.Update(input.DisplayName, input.Email, input.PhoneNumber, input.Relationship, input.Role);
        await _trustees.UpdateAsync(trustee);
        if (roleChanged) await MarkKeysOutdatedAsync();
        await Audit.RecordAsync(new AuditEntry(AuditActions.TrusteeUpdated, UserId, trustee.Id, AuditActorType.Owner,
            UserId, CurrentUserDisplayName, nameof(Trustee), id.ToString(), $"Vai trò: {trustee.Role}"));
        return trustee.ToDto(false, 0);
    }

    /// <summary>Xoá người được uỷ quyền: huỷ luôn mảnh khoá và grant của họ; owner cần phân mảnh lại.</summary>
    public async Task DeleteAsync(Guid id)
    {
        var trustee = await GetMyTrusteeAsync(id);
        await _keyShares.DeleteAsync(k => k.TrusteeId == id);
        await _grants.DeleteAsync(g => g.TrusteeId == id);
        await _trustees.DeleteAsync(trustee);
        await MarkKeysOutdatedAsync();
        await Audit.RecordAsync(new AuditEntry(AuditActions.TrusteeRemoved, UserId, trustee.Id, AuditActorType.Owner,
            UserId, CurrentUserDisplayName, nameof(Trustee), id.ToString(), trustee.DisplayName));
    }

    public async Task ResendInvitationAsync(Guid id)
    {
        var owner = await GetOwnerAsync();
        var trustee = await GetMyTrusteeAsync(id);
        var token = trustee.IssueInvitationToken(Clock.Now);
        await _trustees.UpdateAsync(trustee);
        await SendInvitationAsync(owner, trustee, token);
    }

    private async Task SendInvitationAsync(OwnerProfile owner, Trustee trustee, string token)
    {
        var roleName = trustee.Role switch
        {
            TrusteeRole.KeyHolder => "người giữ mảnh khoá",
            TrusteeRole.Verifier => "người xác nhận",
            _ => "người nhận nội dung"
        };
        var link = $"{_urls.TrusteeUrl}/invite?token={Uri.EscapeDataString(token)}";
        var (subject, body) = NotificationTemplates.TrusteeInvitation(trustee.DisplayName, owner.DisplayName, roleName, link);
        await _notifier.SendAsync(new NotificationMessage(trustee.DisplayName, trustee.Email, trustee.PhoneNumber, subject, body,
            NotificationChannels.Email | NotificationChannels.Sms));
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
