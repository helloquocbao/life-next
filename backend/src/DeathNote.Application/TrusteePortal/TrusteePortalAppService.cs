using DeathNote.AuditTrail;
using DeathNote.Common;
using DeathNote.Lifecycle;
using DeathNote.Owners;
using DeathNote.Trustees;
using DeathNote.Vaults;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Domain.Repositories;

namespace DeathNote.TrusteePortal;

/// <summary>
/// Cổng dành cho người được owner giao vai trò. Nguyên tắc UX: web-first, không bắt cài app,
/// mỗi màn hình chỉ một việc cần làm — vì ngày họ cần đến là ngày tâm lý tệ nhất.
/// <para>
/// Hai vai trò: <b>Người nhắc nhở</b> (được báo khi owner im lặng, nhiệm vụ nhắc owner bấm "Tôi vẫn ổn") và
/// <b>Người nhận thông tin</b> (tự động nhận phần owner phân sau khi hết ân hạn). Mọi phương thức đều kiểm tra người
/// dùng hiện tại đúng là trustee của hồ sơ liên quan và cắt dữ liệu theo vai trò + giai đoạn.
/// </para>
/// </summary>
[Authorize]
public class TrusteePortalAppService : DeathNoteAppService, ITrusteePortalAppService
{
    private readonly IRepository<Trustee, Guid> _trustees;
    private readonly IRepository<OwnerProfile, Guid> _owners;
    private readonly IRepository<Vault, Guid> _vaults;
    private readonly IRepository<VaultItem, Guid> _items;
    private readonly IRepository<Grant, Guid> _grants;
    private readonly IRepository<AuditEvent, Guid> _auditEvents;
    private readonly LifecyclePolicy _policy;
    private readonly GrantEscrow _escrow;

    public TrusteePortalAppService(
        IRepository<Trustee, Guid> trustees,
        IRepository<OwnerProfile, Guid> owners,
        IRepository<Vault, Guid> vaults,
        IRepository<VaultItem, Guid> items,
        IRepository<Grant, Guid> grants,
        IRepository<AuditEvent, Guid> auditEvents,
        LifecyclePolicy policy,
        GrantEscrow escrow)
    {
        _trustees = trustees;
        _owners = owners;
        _vaults = vaults;
        _items = items;
        _grants = grants;
        _auditEvents = auditEvents;
        _policy = policy;
        _escrow = escrow;
    }

    // =====================================================================
    //  GIAI ĐOẠN 1 — Lời mời (người nhắc nhở) / link nhận thông tin (người nhận)
    // =====================================================================

    [AllowAnonymous]
    public async Task<InvitationDto> GetInvitationAsync(string token)
    {
        var trustee = await FindByTokenAsync(token);
        var owner = await _owners.GetAsync(trustee.OwnerId);
        return new InvitationDto
        {
            OwnerName = owner.DisplayName,
            TrusteeName = trustee.DisplayName,
            Role = trustee.Role,
            Relationship = trustee.Relationship,
            // Người nhận chỉ nhận được link khi hồ sơ đã bàn giao — đó là link nhận thông tin, không phải lời mời.
            IsDelivery = trustee.Role == TrusteeRole.Recipient && owner.State == LifecycleState.Released
        };
    }

    public async Task<AssignmentDto> AcceptInvitationAsync(AcceptInvitationInput input)
    {
        var trustee = await FindByTokenAsync(input.Token);
        trustee.Accept(UserId, null, Clock.Now);
        await _trustees.UpdateAsync(trustee, autoSave: true);

        await Audit.RecordAsync(new AuditEntry(AuditActions.TrusteeAccepted, trustee.OwnerId, trustee.Id, AuditActorType.Trustee,
            UserId, trustee.DisplayName, nameof(Trustee), trustee.Id.ToString()));
        return await BuildAssignmentAsync(trustee);
    }

    public async Task<List<AssignmentDto>> GetAssignmentsAsync()
    {
        var mine = await _trustees.GetListAsync(t => t.UserId == UserId);
        var result = new List<AssignmentDto>();
        foreach (var t in mine) result.Add(await BuildAssignmentAsync(t));
        return result;
    }

    // =====================================================================
    //  GIAI ĐOẠN 2 — Cảnh báo (người nhắc nhở)
    // =====================================================================

    /// <summary>
    /// Người nhắc nhở ghi nhận "đã liên lạc được owner" / "chưa liên lạc được". Chỉ để owner và đội vận hành thấy
    /// ai đã làm gì — KHÔNG làm đổi thời hạn: chỉ có owner bấm "Tôi vẫn ổn" mới dừng được việc bàn giao.
    /// </summary>
    public async Task RespondContactAsync(ContactResponseInput input)
    {
        var trustee = await GetMyTrusteeAsync(input.TrusteeId);
        if (trustee.Role != TrusteeRole.Reminder) throw new BusinessException(DeathNoteErrorCodes.NotATrustee);
        var owner = await _owners.GetAsync(trustee.OwnerId);
        if (owner.State != LifecycleState.Grace) throw new BusinessException(DeathNoteErrorCodes.ReleaseNotAllowedInState);

        trustee.RecordContactResponse(input.Response, Clock.Now);
        await _trustees.UpdateAsync(trustee);
        await Audit.RecordAsync(new AuditEntry(AuditActions.TrusteeContactResponse, owner.Id, trustee.Id, AuditActorType.Trustee,
            UserId, trustee.DisplayName, Detail: input.Response == ContactResponse.CanReach ? "Vẫn liên lạc được" : "Không liên lạc được"));
    }

    // =====================================================================
    //  GIAI ĐOẠN 3 — Sau khi bàn giao (người nhận thông tin)
    // =====================================================================

    /// <summary>
    /// Hộp nhận: trả Grant đã mã hoá + khoá giao hàng của ĐÚNG người nhận này, chỉ khi hồ sơ đã bàn giao. Việc giải mã
    /// grant và hạng mục diễn ra trên trình duyệt người nhận. Người nhận không cần tạo khoá hay nhớ passphrase gì —
    /// chỉ cần đăng nhập (xác thực bằng link trong email lúc bàn giao).
    /// </summary>
    public async Task<InboxDto> GetInboxAsync(Guid trusteeId)
    {
        var trustee = await GetMyRecipientAsync(trusteeId);
        var owner = await GetReleasedOwnerAsync(trustee);
        var version = (await _vaults.FindAsync(owner.Id))?.KeyVersion ?? -1;
        var grant = await _grants.FirstOrDefaultAsync(g => g.TrusteeId == trustee.Id && g.KeyVersion == version);

        await Audit.RecordAsync(new AuditEntry(AuditActions.ReleasedDataAccessed, owner.Id, trustee.Id, AuditActorType.Trustee,
            UserId, trustee.DisplayName, Detail: $"Mở hộp nhận ({grant?.ItemCount ?? 0} hạng mục)"));

        return new InboxDto
        {
            TrusteeId = trustee.Id,
            OwnerName = owner.DisplayName,
            ReleasedAt = owner.StateChangedAt,
            EncryptedGrant = grant?.SealedPayload,
            DeliveryKey = grant?.EscrowedKey is { } escrowed ? _escrow.Unprotect(escrowed, trustee.Id) : null,
            GrantItemCount = grant?.ItemCount ?? 0
        };
    }

    /// <summary>
    /// Trả ciphertext của các hạng mục yêu cầu. Server không biết trustee được phân mục nào (grant đã mã hoá),
    /// nên trả ciphertext cho mọi Id hợp lệ của hồ sơ — trustee chỉ giải mã được mục có ItemKey trong grant của mình.
    /// </summary>
    public async Task<List<ReleasedItemDto>> GetReleasedItemsAsync(GetReleasedItemsInput input)
    {
        var trustee = await GetMyRecipientAsync(input.TrusteeId);
        var owner = await GetReleasedOwnerAsync(trustee);
        var ids = input.Ids.Take(500).ToList();
        var items = await _items.GetListAsync(i => i.OwnerId == owner.Id && ids.Contains(i.Id));
        return items.Select(i => new ReleasedItemDto { Id = i.Id, Ciphertext = i.Ciphertext }).ToList();
    }

    /// <summary>Log liên quan đến mình: sự kiện gắn với chính trustee này + sự kiện bàn giao tự động.</summary>
    public async Task<List<AuditEventDto>> GetActivityAsync(Guid trusteeId)
    {
        var trustee = await GetMyTrusteeAsync(trusteeId);
        var query = (await _auditEvents.GetQueryableAsync())
            .Where(e => e.TrusteeId == trustee.Id || (e.OwnerId == trustee.OwnerId && e.Action == AuditActions.AutoReleased))
            .OrderByDescending(e => e.Sequence).Take(100);
        return (await AsyncExecuter.ToListAsync(query)).Select(e => e.ToDto()).ToList();
    }

    // =====================================================================
    //  Nội bộ
    // =====================================================================

    private async Task<AssignmentDto> BuildAssignmentAsync(Trustee t)
    {
        var owner = await _owners.GetAsync(t.OwnerId);
        var vault = await _vaults.FindAsync(owner.Id);
        var version = vault?.KeyVersion ?? -1;
        var grant = await _grants.FirstOrDefaultAsync(g => g.TrusteeId == t.Id && g.KeyVersion == version);

        // Người nhận thông tin KHÔNG được báo gì trước khi bàn giao (owner chưa muốn họ biết chuyện owner im lặng).
        var phase = owner.State switch
        {
            LifecycleState.Released => TrusteePhase.Released,
            LifecycleState.Grace when t.Role == TrusteeRole.Reminder => TrusteePhase.Alert,
            _ => TrusteePhase.Normal
        };

        var dto = new AssignmentDto
        {
            TrusteeId = t.Id,
            OwnerId = owner.Id,
            OwnerName = owner.DisplayName,
            Role = t.Role,
            Relationship = t.Relationship,
            Phase = phase,
            GrantItemCount = grant?.ItemCount ?? 0,
            HasGrant = grant != null,
            ServerNow = Clock.Now,
            TimeScale = _policy.Options.TimeScale
        };

        if (phase == TrusteePhase.Released) dto.ReleasedAt = owner.StateChangedAt;
        if (phase != TrusteePhase.Alert) return dto;

        dto.LastCheckInAt = owner.LastCheckInAt;
        dto.SilentDays = owner.LastCheckInAt.HasValue
            ? (int)Math.Floor((Clock.Now - owner.LastCheckInAt.Value).TotalDays * _policy.Options.TimeScale) : null;
        dto.ReleaseAt = owner.GraceEndsAt(_policy);
        dto.MyContactResponse = t.LastContactResponseAt > owner.LastCheckInAt ? t.LastContactResponse : null;
        return dto;
    }

    /// <summary>Hồ sơ phải đã bàn giao (Released) thì người nhận mới được lấy phần của mình.</summary>
    private async Task<OwnerProfile> GetReleasedOwnerAsync(Trustee trustee)
    {
        var owner = await _owners.GetAsync(trustee.OwnerId);
        if (owner.State != LifecycleState.Released) throw new BusinessException(DeathNoteErrorCodes.ReleaseNotYetReleased);
        return owner;
    }

    private async Task<Trustee> FindByTokenAsync(string token)
    {
        var hash = Trustee.HashToken(token);
        var trustee = await _trustees.FirstOrDefaultAsync(t => t.InvitationTokenHash == hash);
        if (trustee == null || !trustee.MatchesToken(token)) throw new BusinessException(DeathNoteErrorCodes.InvitationInvalid);
        return trustee;
    }

    private async Task<Trustee> GetMyTrusteeAsync(Guid trusteeId)
    {
        var t = await _trustees.FindAsync(trusteeId);
        if (t == null || t.UserId != UserId) throw new BusinessException(DeathNoteErrorCodes.NotATrustee);
        return t;
    }

    private async Task<Trustee> GetMyRecipientAsync(Guid trusteeId)
    {
        var t = await GetMyTrusteeAsync(trusteeId);
        // Người nhắc nhở không nhận thông tin nào trong két.
        if (t.Role != TrusteeRole.Recipient) throw new BusinessException(DeathNoteErrorCodes.NotATrustee);
        return t;
    }

    private async Task MarkOwnerKeysOutdatedAsync(Guid ownerId)
    {
        var vault = await _vaults.FindAsync(ownerId);
        if (vault == null) return;
        vault.MarkKeysOutdated();
        await _vaults.UpdateAsync(vault);
    }
}
