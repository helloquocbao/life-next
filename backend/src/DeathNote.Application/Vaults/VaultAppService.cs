using DeathNote.AuditTrail;
using DeathNote.Common;
using DeathNote.Lifecycle;
using DeathNote.Owners;
using DeathNote.Trustees;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Uow;

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
    private readonly GrantEscrow _escrow;

    public VaultAppService(IRepository<Vault, Guid> vaults, IRepository<VaultItem, Guid> items, IRepository<OwnerProfile, Guid> owners,
        IRepository<Trustee, Guid> trustees, IRepository<KeyShare, Guid> keyShares, IRepository<Grant, Guid> grants,
        GrantEscrow escrow)
    {
        _vaults = vaults;
        _items = items;
        _owners = owners;
        _trustees = trustees;
        _keyShares = keyShares;
        _grants = grants;
        _escrow = escrow;
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
    /// Lưu phần dành cho từng người nhận: mỗi Grant được mã hoá ngay trên trình duyệt owner bằng một khoá giao hàng riêng;
    /// server giữ khoá giao hàng (mã hoá bằng khoá chủ cấu hình, xem <see cref="GrantEscrow"/>) và chỉ trao khi hồ sơ
    /// bàn giao. Người nhận KHÔNG cần được mời hay tạo khoá trước — họ mặc định không biết gì. Quy tắc: chỉ trao cho
    /// người ở vai trò "người nhận thông tin", không trùng người. Toàn bộ Grant cũ bị thay thế (phiên bản tăng lên).
    /// </summary>
    public async Task<VaultDto> DistributeKeysAsync(DistributeKeysInput input)
    {
        var vault = await GetVaultAsync();
        var owner = await _owners.GetAsync(UserId);
        if (owner.State == LifecycleState.Released) throw new BusinessException(DeathNoteErrorCodes.AlreadyReleased);

        var trustees = await _trustees.GetListAsync(t => t.OwnerId == UserId);
        var recipientIds = trustees.Where(t => t.Role == TrusteeRole.Recipient).Select(t => t.Id).ToHashSet();
        if (input.Grants.Any(g => !recipientIds.Contains(g.TrusteeId)) || input.Grants.Select(g => g.TrusteeId).Distinct().Count() != input.Grants.Count)
            throw new BusinessException(DeathNoteErrorCodes.InvalidShareDeliveries);

        var now = Clock.Now;
        vault.RegisterKeyDistribution(input.EncryptedAllocation, now);
        await _vaults.UpdateAsync(vault);

        await _grants.DeleteAsync(g => g.OwnerId == UserId);
        await _grants.InsertManyAsync(input.Grants.Select(g =>
            new Grant(GuidGenerator.Create(), UserId, g.TrusteeId, vault.KeyVersion, g.SealedPayload,
                _escrow.Protect(g.DeliveryKey, g.TrusteeId), g.ItemCount, now)));

        await Audit.RecordAsync(new AuditEntry(AuditActions.KeysDistributed, UserId, ActorType: AuditActorType.Owner,
            ActorUserId: UserId, ActorName: CurrentUserDisplayName,
            Detail: $"{input.Grants.Count} người nhận, phiên bản {vault.KeyVersion}"));
        return vault.ToDto();
    }

    /// <summary>
    /// Từ bỏ két hiện tại: xoá vĩnh viễn mọi hạng mục, mảnh khoá đã phát và phân bổ. Sau lệnh này,
    /// <see cref="InitializeAsync"/> lại nhận được vì server không còn két nào cho owner này.
    /// Không đụng tới danh sách người được uỷ quyền — họ vẫn được owner tin tưởng, chỉ là owner cần
    /// phân mảnh khoá lại từ đầu sau khi có két mới.
    /// </summary>
    public async Task AbandonAsync()
    {
        var vault = await GetVaultAsync();
        // QUAN TRỌNG: Vault và VaultItem kế thừa FullAuditedAggregateRoot ⇒ có ISoftDelete. DeleteAsync
        // thường sẽ chỉ đánh dấu IsDeleted=true (giữ nguyên hàng trong bảng để phục vụ audit thông thường),
        // KHÔNG xoá vật lý. Với Vault, Id = OwnerId cố định — nếu chỉ soft-delete, hàng cũ vẫn chiếm khoá
        // chính, khiến InitializeAsync tạo két mới ngay sau đó bị đụng khoá chính (đã xác nhận bằng test +
        // kiểm tra trực tiếp CSDL). Ở đây owner đã CHỦ ĐỘNG xin xoá vĩnh viễn, nên phải HardDeleteAsync
        // (xoá vật lý thật sự) cho hai loại này. KeyShare/Grant không kế thừa ISoftDelete nên DeleteAsync
        // thường đã là xoá vật lý.
        await _items.HardDeleteAsync(i => i.OwnerId == UserId);
        await _keyShares.DeleteAsync(k => k.OwnerId == UserId);
        await _grants.DeleteAsync(g => g.OwnerId == UserId);
        await _vaults.HardDeleteAsync(vault, autoSave: true);

        var owner = await _owners.GetAsync(UserId);
        owner.ResetForNewVault();
        await _owners.UpdateAsync(owner);

        await Audit.RecordAsync(new AuditEntry(AuditActions.VaultAbandoned, UserId, ActorType: AuditActorType.Owner,
            ActorUserId: UserId, ActorName: CurrentUserDisplayName,
            Detail: "Owner từ bỏ két cũ (quên mật khẩu chính lẫn 12 từ khôi phục) — toàn bộ hạng mục, mảnh khoá và phân bổ cũ đã bị xoá vĩnh viễn."));
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
