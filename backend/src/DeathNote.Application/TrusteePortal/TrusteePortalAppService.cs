using DeathNote.AuditTrail;
using DeathNote.Common;
using DeathNote.Lifecycle;
using DeathNote.Owners;
using DeathNote.Releases;
using DeathNote.Trustees;
using DeathNote.Vaults;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.BlobStoring;
using Volo.Abp.Content;
using Volo.Abp.Domain.Repositories;

namespace DeathNote.TrusteePortal;

/// <summary>
/// Cổng dành cho người được uỷ quyền. Nguyên tắc UX: web-first, không bắt cài app,
/// mỗi màn hình chỉ một việc cần làm — vì ngày họ cần đến là ngày tâm lý tệ nhất.
/// <para>
/// Mọi phương thức đều kiểm tra người dùng hiện tại đúng là trustee của hồ sơ liên quan,
/// và cắt dữ liệu theo giai đoạn (bảng "Ai thấy gì").
/// </para>
/// </summary>
[Authorize]
public class TrusteePortalAppService : DeathNoteAppService, ITrusteePortalAppService
{
    private readonly IRepository<Trustee, Guid> _trustees;
    private readonly IRepository<UserKeyring, Guid> _keyrings;
    private readonly IRepository<OwnerProfile, Guid> _owners;
    private readonly IRepository<Vault, Guid> _vaults;
    private readonly IRepository<VaultItem, Guid> _items;
    private readonly IRepository<KeyShare, Guid> _keyShares;
    private readonly IRepository<Grant, Guid> _grants;
    private readonly IRepository<ReleaseRequest, Guid> _releases;
    private readonly IRepository<AuditEvent, Guid> _auditEvents;
    private readonly IBlobContainer<EvidenceContainer> _evidenceBlobs;
    private readonly ReleaseManager _releaseManager;
    private readonly LifecyclePolicy _policy;

    public TrusteePortalAppService(
        IRepository<Trustee, Guid> trustees,
        IRepository<UserKeyring, Guid> keyrings,
        IRepository<OwnerProfile, Guid> owners,
        IRepository<Vault, Guid> vaults,
        IRepository<VaultItem, Guid> items,
        IRepository<KeyShare, Guid> keyShares,
        IRepository<Grant, Guid> grants,
        IRepository<ReleaseRequest, Guid> releases,
        IRepository<AuditEvent, Guid> auditEvents,
        IBlobContainer<EvidenceContainer> evidenceBlobs,
        ReleaseManager releaseManager,
        LifecyclePolicy policy)
    {
        _trustees = trustees;
        _keyrings = keyrings;
        _owners = owners;
        _vaults = vaults;
        _items = items;
        _keyShares = keyShares;
        _grants = grants;
        _releases = releases;
        _auditEvents = auditEvents;
        _evidenceBlobs = evidenceBlobs;
        _releaseManager = releaseManager;
        _policy = policy;
    }

    // =====================================================================
    //  GIAI ĐOẠN 1 — Lời mời & chuẩn bị
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
            Relationship = trustee.Relationship
        };
    }

    public async Task<AssignmentDto> AcceptInvitationAsync(AcceptInvitationInput input)
    {
        var trustee = await FindByTokenAsync(input.Token);
        var keyring = await _keyrings.FindAsync(UserId);
        trustee.Accept(UserId, keyring?.PublicKey, Clock.Now);
        await _trustees.UpdateAsync(trustee, autoSave: true);
        await MarkOwnerKeysOutdatedAsync(trustee.OwnerId);

        await Audit.RecordAsync(new AuditEntry(AuditActions.TrusteeAccepted, trustee.OwnerId, trustee.Id, AuditActorType.Trustee,
            UserId, trustee.DisplayName, nameof(Trustee), trustee.Id.ToString()));
        return await BuildAssignmentAsync(trustee);
    }

    public async Task<KeyringDto> GetKeyringAsync() => ToDto(await _keyrings.FindAsync(UserId));

    /// <summary>
    /// Lưu cặp khoá cá nhân (khoá riêng đã bọc bằng passphrase của trustee). Sau đó gắn khoá công khai
    /// vào mọi hồ sơ mà người này là trustee, để owner có thể phân mảnh khoá cho họ.
    /// </summary>
    public async Task<KeyringDto> CreateKeyringAsync(CreateKeyringInput input)
    {
        var existing = await _keyrings.FindAsync(UserId);
        if (existing != null) return ToDto(existing);

        var keyring = new UserKeyring(UserId, input.PublicKey, input.EncryptedPrivateKey, input.KdfSalt, input.KdfOpsLimit, input.KdfMemLimit);
        await _keyrings.InsertAsync(keyring, autoSave: true);

        foreach (var t in await _trustees.GetListAsync(t => t.UserId == UserId))
        {
            t.SetPublicKey(input.PublicKey);
            await _trustees.UpdateAsync(t);
            await MarkOwnerKeysOutdatedAsync(t.OwnerId);
            await Audit.RecordAsync(new AuditEntry(AuditActions.TrusteeKeyringCreated, t.OwnerId, t.Id, AuditActorType.Trustee,
                UserId, t.DisplayName));
        }
        return ToDto(keyring);
    }

    public async Task<List<AssignmentDto>> GetAssignmentsAsync()
    {
        var mine = await _trustees.GetListAsync(t => t.UserId == UserId);
        var result = new List<AssignmentDto>();
        foreach (var t in mine) result.Add(await BuildAssignmentAsync(t));
        return result;
    }

    // =====================================================================
    //  GIAI ĐOẠN 2 — Cảnh báo & xác minh
    // =====================================================================

    /// <summary>"Tôi vẫn liên lạc được" / "Tôi không liên lạc được" — chặn phần lớn báo động giả.</summary>
    public async Task RespondContactAsync(ContactResponseInput input)
    {
        var trustee = await GetMyTrusteeAsync(input.TrusteeId);
        var owner = await _owners.GetAsync(trustee.OwnerId);
        if (owner.State < LifecycleState.Grace || owner.State == LifecycleState.Released)
            throw new BusinessException(DeathNoteErrorCodes.ReleaseNotAllowedInState);

        trustee.RecordContactResponse(input.Response, Clock.Now);
        await _trustees.UpdateAsync(trustee);
        await Audit.RecordAsync(new AuditEntry(AuditActions.TrusteeContactResponse, owner.Id, trustee.Id, AuditActorType.Trustee,
            UserId, trustee.DisplayName, Detail: input.Response == ContactResponse.CanReach ? "Vẫn liên lạc được" : "Không liên lạc được"));
    }

    public async Task<ReleaseProgressDto> InitiateReleaseAsync(InitiateReleaseInput input)
    {
        var trustee = await GetMyTrusteeAsync(input.TrusteeId);
        var owner = await _owners.GetAsync(trustee.OwnerId);
        var request = await _releaseManager.InitiateAsync(owner, trustee, input.Reason, input.Statement);
        return await BuildProgressAsync(await _releases.GetWithDetailsAsync(request.Id, AsyncExecuter), trustee);
    }

    /// <summary>
    /// Vật liệu để đồng thuận: mảnh khoá của chính mình (niêm phong cho mình) + khoá công khai của
    /// các trustee nhận. Trình duyệt sẽ mở mảnh bằng khoá riêng rồi niêm phong lại cho từng người.
    /// </summary>
    public async Task<ConsentMaterialDto> GetConsentMaterialAsync(Guid requestId)
    {
        var request = await _releases.GetAsync(requestId);
        var trustee = await GetMyTrusteeForOwnerAsync(request.OwnerId);
        if (trustee.Role != TrusteeRole.KeyHolder) throw new BusinessException(DeathNoteErrorCodes.OnlyKeyHoldersCanConsent);
        var share = await _keyShares.FirstOrDefaultAsync(k => k.TrusteeId == trustee.Id && k.KeyVersion == request.KeyVersion)
                    ?? throw new BusinessException(DeathNoteErrorCodes.OnlyKeyHoldersCanConsent);
        var recipients = (await _trustees.GetListAsync(t => t.OwnerId == request.OwnerId && t.Id != trustee.Id))
            .Where(t => t.IsReadyForKeys)
            .Select(t => new RecipientKeyDto { TrusteeId = t.Id, DisplayName = t.DisplayName, PublicKey = t.PublicKey! })
            .ToList();
        return new ConsentMaterialDto
        {
            RequestId = requestId,
            MyTrusteeId = trustee.Id,
            MySealedShare = share.SealedShare,
            Recipients = recipients
        };
    }

    public async Task<ReleaseProgressDto> ConsentAsync(Guid requestId, ConsentInput input)
    {
        var request = await _releases.GetWithDetailsAsync(requestId, AsyncExecuter);
        var trustee = await GetMyTrusteeForOwnerAsync(request.OwnerId);
        await _releaseManager.ConsentAsync(request, trustee, input.Statement,
            input.Deliveries.Select(d => (d.ToTrusteeId, d.SealedShare)).ToList());
        return await BuildProgressAsync(request, trustee);
    }

    /// <summary>Nộp tệp bằng chứng (≤ 10 MB). Tệp được lưu ở kho riêng, tự xoá sau khi đóng hồ sơ.</summary>
    public async Task<EvidenceBriefDto> UploadEvidenceAsync(Guid requestId, EvidenceKind kind, IRemoteStreamContent file)
    {
        var request = await _releases.GetWithDetailsAsync(requestId, AsyncExecuter);
        var trustee = await GetMyTrusteeForOwnerAsync(request.OwnerId);
        if (trustee.Role == TrusteeRole.ContentOnly) throw new BusinessException(DeathNoteErrorCodes.NotATrustee);

        await using var input = file.GetStream();
        using var buffer = new MemoryStream();
        await input.CopyToAsync(buffer);
        if (buffer.Length > DeathNoteConsts.MaxEvidenceFileBytes) throw new BusinessException(DeathNoteErrorCodes.EvidenceTooLarge);

        var blobName = $"{requestId:N}/{GuidGenerator.Create():N}";
        var evidence = request.AddEvidence(GuidGenerator.Create(), trustee.Id, kind, file.FileName ?? "evidence",
            file.ContentType ?? "application/octet-stream", buffer.Length, blobName, Clock.Now);
        buffer.Position = 0;
        await _evidenceBlobs.SaveAsync(blobName, buffer);
        await _releases.UpdateAsync(request);

        await Audit.RecordAsync(new AuditEntry(AuditActions.EvidenceUploaded, request.OwnerId, trustee.Id, AuditActorType.Trustee,
            UserId, trustee.DisplayName, nameof(ReleaseRequest), request.Id.ToString(), $"{kind}: {evidence.FileName}"));
        return new EvidenceBriefDto
        {
            Id = evidence.Id,
            Kind = evidence.Kind,
            FileName = evidence.FileName,
            SizeBytes = evidence.SizeBytes,
            UploadedAt = evidence.UploadedAt
        };
    }

    public async Task<ReleaseProgressDto> ResubmitAsync(Guid requestId)
    {
        var request = await _releases.GetWithDetailsAsync(requestId, AsyncExecuter);
        var trustee = await GetMyTrusteeForOwnerAsync(request.OwnerId);
        request.ResubmitForReview(Clock.Now);
        await _releases.UpdateAsync(request);
        await Audit.RecordAsync(new AuditEntry(AuditActions.EvidenceUploaded, request.OwnerId, trustee.Id, AuditActorType.Trustee,
            UserId, trustee.DisplayName, nameof(ReleaseRequest), request.Id.ToString(), $"Gửi lại hồ sơ — vòng {request.ReviewRound}"));
        return await BuildProgressAsync(request, trustee);
    }

    // =====================================================================
    //  GIAI ĐOẠN 3 — Sau khi được mở
    // =====================================================================

    /// <summary>
    /// Hộp nhận: trả về các mảnh khoá đã niêm phong cho mình + grant riêng. Việc ghép khoá (Shamir)
    /// và giải mã hoàn toàn diễn ra trên trình duyệt của trustee.
    /// </summary>
    public async Task<InboxDto> GetInboxAsync(Guid trusteeId)
    {
        var trustee = await GetMyTrusteeAsync(trusteeId);
        var owner = await _owners.GetAsync(trustee.OwnerId);
        var request = await GetReleasedRequestAsync(owner);

        var shares = request.ShareDeliveries.Where(d => d.ToTrusteeId == trustee.Id).Select(d => d.SealedShare).ToList();
        var own = await _keyShares.FirstOrDefaultAsync(k => k.TrusteeId == trustee.Id && k.KeyVersion == request.KeyVersion);
        if (own != null) shares.Insert(0, own.SealedShare);
        var grant = await _grants.FirstOrDefaultAsync(g => g.TrusteeId == trustee.Id && g.KeyVersion == request.KeyVersion);

        await Audit.RecordAsync(new AuditEntry(AuditActions.ReleasedDataAccessed, owner.Id, trustee.Id, AuditActorType.Trustee,
            UserId, trustee.DisplayName, Detail: $"Mở hộp nhận ({grant?.ItemCount ?? 0} hạng mục)"));

        return new InboxDto
        {
            TrusteeId = trustee.Id,
            OwnerName = owner.DisplayName,
            ReleasedAt = request.ReleasedAt!.Value,
            Threshold = request.RequiredConsents,
            SealedShares = shares,
            SealedGrant = grant?.SealedPayload,
            GrantItemCount = grant?.ItemCount ?? 0
        };
    }

    /// <summary>
    /// Trả ciphertext của các hạng mục yêu cầu. Server không biết trustee được phân mục nào (grant đã mã hoá),
    /// nên trả ciphertext cho mọi Id hợp lệ của hồ sơ — trustee chỉ giải mã được mục có ItemKey trong grant của mình.
    /// </summary>
    public async Task<List<ReleasedItemDto>> GetReleasedItemsAsync(GetReleasedItemsInput input)
    {
        var trustee = await GetMyTrusteeAsync(input.TrusteeId);
        var owner = await _owners.GetAsync(trustee.OwnerId);
        await GetReleasedRequestAsync(owner);
        var ids = input.Ids.Take(500).ToList();
        var items = await _items.GetListAsync(i => i.OwnerId == owner.Id && ids.Contains(i.Id));
        return items.Select(i => new ReleasedItemDto { Id = i.Id, Ciphertext = i.Ciphertext }).ToList();
    }

    /// <summary>Log liên quan đến mình: sự kiện gắn với chính trustee này + các bước của quy trình mở.</summary>
    public async Task<List<AuditEventDto>> GetActivityAsync(Guid trusteeId)
    {
        var trustee = await GetMyTrusteeAsync(trusteeId);
        var query = (await _auditEvents.GetQueryableAsync())
            .Where(e => e.TrusteeId == trustee.Id || (e.OwnerId == trustee.OwnerId && e.Action.StartsWith("release.")))
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
        var others = await _trustees.CountAsync(x => x.OwnerId == owner.Id && x.Id != t.Id);
        var grant = await _grants.FirstOrDefaultAsync(g => g.TrusteeId == t.Id && g.KeyVersion == version);
        var hasShare = await _keyShares.AnyAsync(k => k.TrusteeId == t.Id && k.KeyVersion == version);

        var phase = owner.State switch
        {
            LifecycleState.Grace => TrusteePhase.Alert,
            LifecycleState.Verifying or LifecycleState.Review or LifecycleState.FinalWait => TrusteePhase.Verifying,
            LifecycleState.Released => TrusteePhase.Released,
            _ => TrusteePhase.Normal // Active + Missed: trustee chưa được báo gì
        };

        var dto = new AssignmentDto
        {
            TrusteeId = t.Id,
            OwnerId = owner.Id,
            OwnerName = owner.DisplayName,
            Role = t.Role,
            Relationship = t.Relationship,
            Phase = phase,
            OtherTrusteeCount = (int)others,
            GrantItemCount = grant?.ItemCount ?? 0,
            HasKeyShare = hasShare,
            ServerNow = Clock.Now,
            TimeScale = _policy.Options.TimeScale
        };

        if (phase == TrusteePhase.Normal) return dto;

        // Từ giai đoạn cảnh báo: được thấy trạng thái heartbeat.
        dto.LastCheckInAt = owner.LastCheckInAt;
        dto.SilentDays = owner.LastCheckInAt.HasValue
            ? (int)Math.Floor((Clock.Now - owner.LastCheckInAt.Value).TotalDays * _policy.Options.TimeScale) : null;
        dto.MyContactResponse = t.LastContactResponseAt > owner.LastCheckInAt ? t.LastContactResponse : null;
        dto.CanInitiateFrom = owner.GraceEndsAt(_policy);
        dto.CanInitiate = t.Role != TrusteeRole.ContentOnly && owner.CanAcceptReleaseRequest(Clock.Now, _policy);

        var latest = (await _releases.GetListAsync(r => r.OwnerId == owner.Id)).OrderByDescending(r => r.InitiatedAt).FirstOrDefault();
        if (latest != null && (latest.IsOpen || latest.Status is ReleaseStatus.Released or ReleaseStatus.Rejected))
        {
            dto.OpenRequest = await BuildProgressAsync(await _releases.GetWithDetailsAsync(latest.Id, AsyncExecuter), t);
            dto.ReleasedAt = latest.ReleasedAt;
        }
        return dto;
    }

    private async Task<ReleaseProgressDto> BuildProgressAsync(ReleaseRequest r, Trustee me)
    {
        var trustees = await _trustees.GetListAsync(t => t.OwnerId == r.OwnerId);
        var names = trustees.ToDictionary(t => t.Id, t => t.DisplayName);
        var myShare = await _keyShares.AnyAsync(k => k.TrusteeId == me.Id && k.KeyVersion == r.KeyVersion);
        return new ReleaseProgressDto
        {
            Id = r.Id,
            Status = r.Status,
            Reason = r.Reason,
            Statement = r.Statement,
            InitiatorName = names.GetValueOrDefault(r.InitiatorTrusteeId, "?"),
            InitiatedAt = r.InitiatedAt,
            RequiredConsents = r.RequiredConsents,
            EffectiveConsents = r.EffectiveConsentCount(_policy.Options.EnforceDistinctConsentIp),
            KeyHolderCount = trustees.Count(t => t.Role == TrusteeRole.KeyHolder && t.IsReadyForKeys),
            Consents = r.Consents.OrderBy(c => c.ConsentedAt)
                .Select(c => new ConsentBriefDto { TrusteeName = names.GetValueOrDefault(c.TrusteeId, "?"), ConsentedAt = c.ConsentedAt }).ToList(),
            HaveIConsented = r.Consents.Any(c => c.TrusteeId == me.Id),
            CanIConsent = r.Status == ReleaseStatus.AwaitingConsent && me.Role == TrusteeRole.KeyHolder && myShare
                          && r.Consents.All(c => c.TrusteeId != me.Id),
            Evidence = r.Evidence.OrderBy(e => e.UploadedAt).Select(e => new EvidenceBriefDto
            {
                Id = e.Id, Kind = e.Kind, FileName = e.FileName, SizeBytes = e.SizeBytes, UploadedAt = e.UploadedAt
            }).ToList(),
            ReviewRound = r.ReviewRound,
            InfoRequestNote = r.Status == ReleaseStatus.NeedsMoreInfo ? r.InfoRequestNote : null,
            FinalWaitUntil = r.FinalWaitUntil,
            ReleasedAt = r.ReleasedAt,
            CloseNote = r.Status == ReleaseStatus.Rejected ? r.CloseNote : null
        };
    }

    private async Task<ReleaseRequest> GetReleasedRequestAsync(OwnerProfile owner)
    {
        if (owner.State != LifecycleState.Released) throw new BusinessException(DeathNoteErrorCodes.ReleaseNotYetReleased);
        var query = await _releases.WithAllDetailsAsync();
        return await AsyncExecuter.FirstOrDefaultAsync(query.Where(r => r.OwnerId == owner.Id && r.Status == ReleaseStatus.Released))
               ?? throw new BusinessException(DeathNoteErrorCodes.ReleaseNotYetReleased);
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

    private async Task<Trustee> GetMyTrusteeForOwnerAsync(Guid ownerId) =>
        await _trustees.FirstOrDefaultAsync(t => t.OwnerId == ownerId && t.UserId == UserId)
        ?? throw new BusinessException(DeathNoteErrorCodes.NotATrustee);

    private async Task MarkOwnerKeysOutdatedAsync(Guid ownerId)
    {
        var vault = await _vaults.FindAsync(ownerId);
        if (vault == null) return;
        vault.MarkKeysOutdated();
        await _vaults.UpdateAsync(vault);
    }

    private static KeyringDto ToDto(UserKeyring? k) => k == null
        ? new KeyringDto { Exists = false }
        : new KeyringDto
        {
            Exists = true,
            PublicKey = k.PublicKey,
            EncryptedPrivateKey = k.EncryptedPrivateKey,
            KdfSalt = k.KdfSalt,
            KdfOpsLimit = k.KdfOpsLimit,
            KdfMemLimit = k.KdfMemLimit
        };
}
