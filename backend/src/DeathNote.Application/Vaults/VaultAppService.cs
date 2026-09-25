using DeathNote.AuditTrail;
using DeathNote.Common;
using DeathNote.Owners;
using DeathNote.Releases;
using DeathNote.Trustees;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;

namespace DeathNote.Vaults;

/// <summary>
/// Két dữ liệu của owner. Server chỉ lưu và trả lại ciphertext — mọi thao tác mã hoá/giải mã
/// diễn ra trên trình duyệt (xem frontend/packages/crypto).
/// </summary>
[Authorize]
public class VaultAppService : DeathNoteAppService, IVaultAppService
{
    private readonly IRepository<Vault, Guid> _vaults;
    private readonly IRepository<VaultItem, Guid> _items;
    private readonly IRepository<OwnerProfile, Guid> _owners;
    private readonly IRepository<Trustee, Guid> _trustees;
    private readonly IRepository<KeyShare, Guid> _keyShares;
    private readonly IRepository<Grant, Guid> _grants;
    private readonly IRepository<ReleaseRequest, Guid> _releases;

    public VaultAppService(IRepository<Vault, Guid> vaults, IRepository<VaultItem, Guid> items, IRepository<OwnerProfile, Guid> owners,
        IRepository<Trustee, Guid> trustees, IRepository<KeyShare, Guid> keyShares, IRepository<Grant, Guid> grants,
        IRepository<ReleaseRequest, Guid> releases)
    {
        _vaults = vaults;
        _items = items;
        _owners = owners;
        _trustees = trustees;
        _keyShares = keyShares;
        _grants = grants;
        _releases = releases;
    }

    public async Task<VaultDto> GetAsync() => (await _vaults.FindAsync(UserId)).ToDto();

    /// <summary>Khởi tạo két: nhận VaultKey đã được bọc bằng passphrase và bằng 12 từ khôi phục.</summary>
    public async Task<VaultDto> InitializeAsync(InitializeVaultInput input)
    {
        await EnsureOwnerAsync();
        if (await _vaults.FindAsync(UserId) != null) throw new BusinessException(DeathNoteErrorCodes.VaultAlreadyInitialized);
        var vault = new Vault(UserId, input.KdfSalt, input.KdfOpsLimit, input.KdfMemLimit,
            input.PassphraseWrappedKey, input.RecoveryWrappedKey, input.RecoverySalt);
        await _vaults.InsertAsync(vault, autoSave: true);
        await Audit.RecordAsync(new AuditEntry(AuditActions.VaultInitialized, UserId, ActorType: AuditActorType.Owner,
            ActorUserId: UserId, ActorName: CurrentUserDisplayName));
        return vault.ToDto();
    }

    public async Task ChangePassphraseAsync(ChangePassphraseInput input)
    {
        var vault = await GetVaultAsync();
        vault.ChangePassphrase(input.KdfSalt, input.KdfOpsLimit, input.KdfMemLimit, input.PassphraseWrappedKey);
        await _vaults.UpdateAsync(vault);
    }

    public async Task<List<VaultItemDto>> GetItemsAsync()
    {
        var items = await _items.GetListAsync(i => i.OwnerId == UserId);
        return items.OrderByDescending(i => i.LastModificationTime ?? i.CreationTime).Select(i => i.ToDto()).ToList();
    }

    public async Task<VaultItemDto> CreateItemAsync(SaveVaultItemInput input)
    {
        await GetVaultAsync();
        var item = new VaultItem(input.Id ?? GuidGenerator.Create(), UserId, input.Ciphertext, input.WrappedItemKey);
        await _items.InsertAsync(item, autoSave: true);
        await Audit.RecordAsync(new AuditEntry(AuditActions.VaultItemCreated, UserId, ActorType: AuditActorType.Owner,
            ActorUserId: UserId, ActorName: CurrentUserDisplayName, TargetType: nameof(VaultItem), TargetId: item.Id.ToString(),
            Detail: $"{item.SizeBytes} byte (đã mã hoá)"));
        return item.ToDto();
    }

    public async Task<VaultItemDto> UpdateItemAsync(Guid id, SaveVaultItemInput input)
    {
        var item = await GetMyItemAsync(id);
        item.SetContent(input.Ciphertext, input.WrappedItemKey);
        await _items.UpdateAsync(item, autoSave: true);
        await Audit.RecordAsync(new AuditEntry(AuditActions.VaultItemUpdated, UserId, ActorType: AuditActorType.Owner,
            ActorUserId: UserId, ActorName: CurrentUserDisplayName, TargetType: nameof(VaultItem), TargetId: id.ToString()));
        return item.ToDto();
    }

    public async Task DeleteItemAsync(Guid id)
    {
        var item = await GetMyItemAsync(id);
        await _items.DeleteAsync(item);
        await Audit.RecordAsync(new AuditEntry(AuditActions.VaultItemDeleted, UserId, ActorType: AuditActorType.Owner,
            ActorUserId: UserId, ActorName: CurrentUserDisplayName, TargetType: nameof(VaultItem), TargetId: id.ToString()));
    }

    /// <summary>
    /// Phân mảnh ReleaseKey cho người giữ khoá và phân bổ hạng mục cho người nhận.
    /// Quy tắc: phải gửi mảnh cho ĐÚNG và ĐỦ mọi người giữ khoá đã sẵn sàng; grant chỉ cho trustee đã có khoá công khai.
    /// Toàn bộ mảnh/grant cũ bị thay thế (phiên bản khoá tăng lên).
    /// </summary>
    public async Task<VaultDto> DistributeKeysAsync(DistributeKeysInput input)
    {
        var vault = await GetVaultAsync();
        if (await _releases.AnyAsync(r => r.OwnerId == UserId && r.Status != ReleaseStatus.Released
                                          && r.Status != ReleaseStatus.Rejected && r.Status != ReleaseStatus.CancelledByOwner))
            throw new BusinessException(DeathNoteErrorCodes.ReleaseAlreadyOpen);

        var trustees = await _trustees.GetListAsync(t => t.OwnerId == UserId);
        var readyIds = trustees.Where(t => t.IsReadyForKeys).Select(t => t.Id).ToHashSet();
        var keyHolderIds = trustees.Where(t => t.Role == TrusteeRole.KeyHolder && t.IsReadyForKeys).Select(t => t.Id).ToHashSet();

        var shareIds = input.Shares.Select(s => s.TrusteeId).ToList();
        if (shareIds.Count != keyHolderIds.Count || !keyHolderIds.SetEquals(shareIds))
            throw new BusinessException(DeathNoteErrorCodes.InvalidShareDeliveries);
        if (input.Grants.Any(g => !readyIds.Contains(g.TrusteeId)) || input.Grants.Select(g => g.TrusteeId).Distinct().Count() != input.Grants.Count)
            throw new BusinessException(DeathNoteErrorCodes.InvalidShareDeliveries);

        vault.RegisterKeyDistribution(input.Threshold, keyHolderIds.Count, input.WrappedReleaseKey, input.EncryptedAllocation, Clock.Now);
        await _vaults.UpdateAsync(vault);

        await _keyShares.DeleteAsync(k => k.OwnerId == UserId);
        await _grants.DeleteAsync(g => g.OwnerId == UserId);
        var now = Clock.Now;
        await _keyShares.InsertManyAsync(input.Shares.Select(s =>
            new KeyShare(GuidGenerator.Create(), UserId, s.TrusteeId, vault.KeyVersion, s.SealedShare, now)));
        await _grants.InsertManyAsync(input.Grants.Select(g =>
            new Grant(GuidGenerator.Create(), UserId, g.TrusteeId, vault.KeyVersion, g.SealedPayload, g.ItemCount, now)));

        await Audit.RecordAsync(new AuditEntry(AuditActions.KeysDistributed, UserId, ActorType: AuditActorType.Owner,
            ActorUserId: UserId, ActorName: CurrentUserDisplayName,
            Detail: $"Ngưỡng {input.Threshold}/{keyHolderIds.Count}, {input.Grants.Count} người nhận, phiên bản khoá {vault.KeyVersion}"));
        return vault.ToDto();
    }

    private async Task EnsureOwnerAsync()
    {
        if (await _owners.FindAsync(UserId) == null) throw new BusinessException(DeathNoteErrorCodes.OnboardingRequired);
    }

    private async Task<Vault> GetVaultAsync() =>
        await _vaults.FindAsync(UserId) ?? throw new BusinessException(DeathNoteErrorCodes.VaultNotInitialized);

    private async Task<VaultItem> GetMyItemAsync(Guid id)
    {
        var item = await _items.FindAsync(id);
        // Không tiết lộ sự tồn tại của hạng mục thuộc người khác.
        if (item == null || item.OwnerId != UserId) throw new EntityNotFoundException(typeof(VaultItem), id);
        return item;
    }
}
