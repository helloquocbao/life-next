using DeathNote.AuditTrail;
using DeathNote.Lifecycle;
using DeathNote.Owners;
using DeathNote.Permissions;
using DeathNote.Releases;
using DeathNote.Trustees;
using DeathNote.Vaults;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Authorization;
using Volo.Abp.BlobStoring;
using Volo.Abp.Content;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;

namespace DeathNote.Admin;

/// <summary>
/// Màn hình quan trọng nhất của Admin console: hàng chờ duyệt mở vault và hồ sơ chi tiết.
/// <para>
/// Admin là người THẨM ĐỊNH HỒ SƠ, không phải người quản trị dữ liệu: không có API nào
/// trả về nội dung vault — kể cả ciphertext.
/// </para>
/// </summary>
[Authorize(DeathNotePermissions.Releases.Default)]
public class ReleaseReviewAppService : DeathNoteAppService, IReleaseReviewAppService
{
    private readonly IRepository<ReleaseRequest, Guid> _releases;
    private readonly IRepository<OwnerProfile, Guid> _owners;
    private readonly IRepository<Trustee, Guid> _trustees;
    private readonly IRepository<Heartbeat, Guid> _heartbeats;
    private readonly IRepository<VaultItem, Guid> _items;
    private readonly IRepository<KeyShare, Guid> _keyShares;
    private readonly IRepository<AuditEvent, Guid> _auditEvents;
    private readonly IBlobContainer<EvidenceContainer> _evidenceBlobs;
    private readonly ReleaseManager _releaseManager;
    private readonly ReleaseRiskAnalyzer _riskAnalyzer;
    private readonly LifecyclePolicy _policy;

    public ReleaseReviewAppService(
        IRepository<ReleaseRequest, Guid> releases,
        IRepository<OwnerProfile, Guid> owners,
        IRepository<Trustee, Guid> trustees,
        IRepository<Heartbeat, Guid> heartbeats,
        IRepository<VaultItem, Guid> items,
        IRepository<KeyShare, Guid> keyShares,
        IRepository<AuditEvent, Guid> auditEvents,
        IBlobContainer<EvidenceContainer> evidenceBlobs,
        ReleaseManager releaseManager,
        ReleaseRiskAnalyzer riskAnalyzer,
        LifecyclePolicy policy)
    {
        _releases = releases;
        _owners = owners;
        _trustees = trustees;
        _heartbeats = heartbeats;
        _items = items;
        _keyShares = keyShares;
        _auditEvents = auditEvents;
        _evidenceBlobs = evidenceBlobs;
        _releaseManager = releaseManager;
        _riskAnalyzer = riskAnalyzer;
        _policy = policy;
    }

    // =====================================================================
    //  HÀNG CHỜ
    // =====================================================================

    /// <summary>Hàng chờ, sắp theo độ khẩn: quá SLA trước, rồi tới hồ sơ chờ lâu nhất.</summary>
    public async Task<PagedResultDto<ReleaseQueueItemDto>> GetQueueAsync(GetReleaseQueueInput input)
    {
        var query = await _releases.WithAllDetailsAsync();
        query = (input.Tab ?? "pending") switch
        {
            "consent" => query.Where(r => r.Status == ReleaseStatus.AwaitingConsent),
            "closed" => query.Where(r => r.Status == ReleaseStatus.Released || r.Status == ReleaseStatus.Rejected || r.Status == ReleaseStatus.CancelledByOwner),
            "all" => query,
            _ => query.Where(r => r.Status == ReleaseStatus.AwaitingFirstReview || r.Status == ReleaseStatus.AwaitingSecondReview
                                  || r.Status == ReleaseStatus.NeedsMoreInfo || r.Status == ReleaseStatus.FinalWait)
        };

        var total = await AsyncExecuter.LongCountAsync(query);
        var page = await AsyncExecuter.ToListAsync(query
            .OrderBy(r => r.ReviewRequestedAt == null)
            .ThenBy(r => r.ReviewRequestedAt)
            .ThenByDescending(r => r.InitiatedAt)
            .Skip(input.SkipCount).Take(input.MaxResultCount));

        var ownerIds = page.Select(r => r.OwnerId).Distinct().ToList();
        var owners = (await _owners.GetListAsync(o => ownerIds.Contains(o.Id))).ToDictionary(o => o.Id);
        var trustees = (await _trustees.GetListAsync(t => ownerIds.Contains(t.OwnerId))).GroupBy(t => t.OwnerId)
            .ToDictionary(g => g.Key, g => (IReadOnlyCollection<Trustee>)g.ToList());

        var now = Clock.Now;
        var items = page.Select(r =>
        {
            var owner = owners[r.OwnerId];
            var flags = _riskAnalyzer.Analyze(r, owner, trustees.GetValueOrDefault(r.OwnerId, Array.Empty<Trustee>()));
            var slaDue = SlaDue(r);
            return new ReleaseQueueItemDto
            {
                Id = r.Id,
                OwnerName = owner.DisplayName,
                Status = r.Status,
                Reason = r.Reason,
                InitiatedAt = r.InitiatedAt,
                ReviewRequestedAt = r.ReviewRequestedAt,
                SlaDueAt = slaDue,
                IsSlaOverdue = slaDue.HasValue && slaDue < now,
                EffectiveConsents = r.EffectiveConsentCount(_policy.Options.EnforceDistinctConsentIp),
                RequiredConsents = r.RequiredConsents,
                EvidenceCount = r.Evidence.Count,
                MaxRisk = flags.Count == 0 ? null : flags.Max(f => f.Severity),
                RiskFlagCount = flags.Count,
                ReviewRound = r.ReviewRound,
                CurrentStage = r.CurrentReviewStage,
                FinalWaitUntil = r.FinalWaitUntil
            };
        })
        .OrderByDescending(x => x.IsSlaOverdue)
        .ToList();

        return new PagedResultDto<ReleaseQueueItemDto>(total, items);
    }

    // =====================================================================
    //  HỒ SƠ CHI TIẾT — 5 khối
    // =====================================================================

    public async Task<ReleaseCaseDto> GetAsync(Guid id)
    {
        var r = await _releases.GetWithDetailsAsync(id, AsyncExecuter);
        return await BuildCaseAsync(r);
    }

    private async Task<ReleaseCaseDto> BuildCaseAsync(ReleaseRequest r)
    {
        var owner = await _owners.GetAsync(r.OwnerId);
        var trustees = await _trustees.GetListAsync(t => t.OwnerId == owner.Id);
        var byId = trustees.ToDictionary(t => t.Id);
        var flags = _riskAnalyzer.Analyze(r, owner, trustees);
        var itemQuery = (await _items.GetQueryableAsync()).Where(i => i.OwnerId == owner.Id);
        var canViewEvidence = await AuthorizationService.IsGrantedAsync(DeathNotePermissions.Releases.Evidence);
        string Name(Guid tid) => byId.TryGetValue(tid, out var t) ? t.DisplayName : "(đã xoá)";

        var dto = new ReleaseCaseDto
        {
            Id = r.Id,
            Status = r.Status,
            Reason = r.Reason,
            Statement = r.Statement,
            InitiatedAt = r.InitiatedAt,
            InitiatorName = Name(r.InitiatorTrusteeId),
            RequiredConsents = r.RequiredConsents,
            EffectiveConsents = r.EffectiveConsentCount(_policy.Options.EnforceDistinctConsentIp),
            ReviewRound = r.ReviewRound,
            CurrentStage = r.CurrentReviewStage,
            InfoRequestNote = r.InfoRequestNote,
            FinalWaitUntil = r.FinalWaitUntil,
            ReleasedAt = r.ReleasedAt,
            CloseNote = r.CloseNote,
            SlaDueAt = SlaDue(r),
            CanViewEvidence = canViewEvidence,
            Owner = new CaseOwnerDto
            {
                DisplayName = owner.DisplayName,
                Email = owner.Email,
                PhoneNumber = owner.PhoneNumber,
                State = owner.State,
                LastCheckInAt = owner.LastCheckInAt,
                CheckInIntervalDays = owner.CheckInIntervalDays,
                GraceDays = owner.GraceDays,
                GraceStartedAt = owner.GraceStartedAt,
                AccountCreatedAt = owner.CreationTime,
                VaultItemCount = await AsyncExecuter.CountAsync(itemQuery),
                VaultSizeBytes = await AsyncExecuter.SumAsync(itemQuery, i => (long)i.SizeBytes)
            },
            Consents = r.Consents.OrderBy(c => c.ConsentedAt).Select(c => new CaseConsentDto
            {
                TrusteeName = Name(c.TrusteeId),
                Relationship = byId.GetValueOrDefault(c.TrusteeId)?.Relationship,
                ConsentedAt = c.ConsentedAt,
                IpAddress = c.IpAddress,
                UserAgent = c.UserAgent,
                Statement = c.Statement
            }).ToList(),
            Trustees = trustees.OrderBy(t => t.CreationTime).Select(t => new CaseTrusteeDto
            {
                DisplayName = t.DisplayName,
                Relationship = t.Relationship,
                Role = t.Role,
                Status = t.Status,
                AddedAt = t.CreationTime,
                LastContactResponse = t.LastContactResponse,
                LastContactResponseAt = t.LastContactResponseAt
            }).ToList(),
            Evidence = r.Evidence.OrderBy(e => e.UploadedAt).Select(e => new CaseEvidenceDto
            {
                Id = e.Id,
                Kind = e.Kind,
                FileName = e.FileName,
                ContentType = e.ContentType,
                SizeBytes = e.SizeBytes,
                UploadedAt = e.UploadedAt,
                UploadedBy = Name(e.UploadedByTrusteeId),
                PurgedAt = e.PurgedAt
            }).ToList(),
            RiskFlags = flags.Select(f => new RiskFlagDto { Code = f.Code, Severity = f.Severity, Message = f.Message }).ToList(),
            Votes = r.Votes.OrderBy(v => v.VotedAt).Select(v => new ReviewVoteDto
            {
                Round = v.Round, Stage = v.Stage, AdminName = v.AdminName, Decision = v.Decision, Note = v.Note, VotedAt = v.VotedAt
            }).ToList()
        };

        dto.Summary = await BuildDecisionSummaryAsync(r, owner, trustees, flags);
        dto.Timeline = await BuildTimelineAsync(r, owner);
        (dto.MyVoteStage, dto.MyVoteBlockedReason) = await GetMyVoteStageAsync(r);
        return dto;
    }

    /// <summary>Khối 1 — tóm tắt quyết định theo 4 cổng: thời gian, con người, bằng chứng, mật mã.</summary>
    private async Task<DecisionSummaryDto> BuildDecisionSummaryAsync(ReleaseRequest r, OwnerProfile owner, List<Trustee> trustees, List<RiskFlag> flags)
    {
        var effective = r.EffectiveConsentCount(_policy.Options.EnforceDistinctConsentIp);
        var gates = new List<GateDto>();

        var silentSince = owner.LastCheckInAt;
        var timeOk = silentSince.HasValue && silentSince < r.InitiatedAt && owner.State >= LifecycleState.Verifying;
        gates.Add(new GateDto
        {
            Code = "time", Name = "Thời gian", Passed = timeOk,
            Detail = timeOk
                ? $"Owner im lặng từ {silentSince:dd/MM/yyyy HH:mm}, đã qua nhắc nhở và thời gian ân hạn {owner.GraceDays} ngày."
                : "Owner đã check-in hoặc chưa qua đủ thời gian."
        });

        gates.Add(new GateDto
        {
            Code = "human", Name = "Con người", Passed = effective >= r.RequiredConsents,
            Detail = $"{effective}/{r.RequiredConsents} người giữ khoá độc lập đã đồng thuận"
                     + (effective < r.Consents.Count ? $" ({r.Consents.Count - effective} phiếu trùng IP không được tính)." : ".")
        });

        var evidenceOk = r.Evidence.Count > 0;
        gates.Add(new GateDto
        {
            Code = "evidence", Name = "Bằng chứng", Passed = evidenceOk,
            Detail = evidenceOk ? $"{r.Evidence.Count} tài liệu đã nộp — cần thẩm định viên đối chiếu." : "Chưa có tài liệu bằng chứng."
        });

        // Cổng mật mã: mọi trustee nhận phải có đủ ≥ m mảnh khoá (mảnh riêng + mảnh được chuyển).
        var ownShares = (await _keyShares.GetListAsync(k => k.OwnerId == owner.Id && k.KeyVersion == r.KeyVersion))
            .Select(k => k.TrusteeId).ToHashSet();
        var recipients = trustees.Where(t => t.IsReadyForKeys).ToList();
        var minShares = recipients.Count == 0 ? 0 : recipients.Min(t =>
            r.ShareDeliveries.Count(d => d.ToTrusteeId == t.Id) + (ownShares.Contains(t.Id) ? 1 : 0));
        gates.Add(new GateDto
        {
            Code = "crypto", Name = "Mật mã", Passed = recipients.Count > 0 && minShares >= r.RequiredConsents,
            Detail = $"Mỗi người nhận có tối thiểu {minShares}/{r.RequiredConsents} mảnh khoá cần thiết để tự giải mã."
        });

        var passed = gates.Count(g => g.Passed);
        var high = flags.Count(f => f.Severity == RiskSeverity.High);
        var recommendation = passed == gates.Count && high == 0
            ? $"Đủ {passed}/{gates.Count} điều kiện, không có cờ rủi ro mức cao — đề xuất DUYỆT sau khi đối chiếu bằng chứng."
            : passed < gates.Count
                ? $"Mới đạt {passed}/{gates.Count} điều kiện — thiếu: {string.Join(", ", gates.Where(g => !g.Passed).Select(g => g.Name))}. Đề xuất YÊU CẦU BỔ SUNG."
                : $"Đủ điều kiện nhưng có {high} cờ rủi ro mức cao — cần xem xét kỹ trước khi duyệt.";

        return new DecisionSummaryDto { Gates = gates, AllGatesPassed = passed == gates.Count, Recommendation = recommendation };
    }

    /// <summary>Khối 2 — timeline: heartbeat cuối, các lần nhắc, phản hồi của trustee, các bước của hồ sơ.</summary>
    private async Task<List<TimelineEntryDto>> BuildTimelineAsync(ReleaseRequest r, OwnerProfile owner)
    {
        var timeline = new List<TimelineEntryDto>();
        var heartbeats = await AsyncExecuter.ToListAsync((await _heartbeats.GetQueryableAsync())
            .Where(h => h.OwnerId == owner.Id).OrderByDescending(h => h.OccurredAt).Take(5));
        timeline.AddRange(heartbeats.Select(h => new TimelineEntryDto
        {
            At = h.OccurredAt, Kind = "heartbeat", Title = h.WasVeto ? "Owner check-in (phủ quyết)" : "Owner check-in",
            Detail = $"Kênh {h.Channel}" + (h.IpAddress != null ? $" — IP {h.IpAddress}" : "")
        }));

        string[] interesting =
        [
            AuditActions.ReminderSent, AuditActions.StateChanged, AuditActions.TrusteeContactResponse, AuditActions.ReleaseInitiated,
            AuditActions.ReleaseConsented, AuditActions.EvidenceUploaded, AuditActions.ReviewVoteCast, AuditActions.ReleaseFinalWaitStarted,
            AuditActions.ReleaseCompleted, AuditActions.ReleaseRejected, AuditActions.ReleaseCancelled, AuditActions.OwnerVeto, AuditActions.EvidenceViewed
        ];
        var since = (owner.LastCheckInAt ?? r.InitiatedAt).AddMinutes(-1);
        var events = await AsyncExecuter.ToListAsync((await _auditEvents.GetQueryableAsync())
            .Where(e => e.OwnerId == owner.Id && e.OccurredAt >= since && interesting.Contains(e.Action))
            .OrderBy(e => e.Sequence).Take(200));
        timeline.AddRange(events.Select(e => new TimelineEntryDto
        {
            At = e.OccurredAt,
            Kind = e.Action,
            Title = e.Action switch
            {
                AuditActions.ReminderSent => "Gửi nhắc check-in",
                AuditActions.StateChanged => "Chuyển trạng thái",
                AuditActions.TrusteeContactResponse => $"{e.ActorName} phản hồi liên lạc",
                AuditActions.ReleaseInitiated => $"{e.ActorName} khởi tạo yêu cầu mở",
                AuditActions.ReleaseConsented => $"{e.ActorName} đồng thuận",
                AuditActions.EvidenceUploaded => $"{e.ActorName} nộp bằng chứng",
                AuditActions.ReviewVoteCast => $"{e.ActorName} bỏ phiếu",
                AuditActions.ReleaseFinalWaitStarted => "Bắt đầu thời gian chờ cuối",
                AuditActions.ReleaseCompleted => "Đã bàn giao",
                AuditActions.ReleaseRejected => "Từ chối",
                AuditActions.ReleaseCancelled => "Owner huỷ tiến trình",
                AuditActions.OwnerVeto => "Owner phủ quyết",
                AuditActions.EvidenceViewed => $"{e.ActorName} xem bằng chứng",
                _ => e.Action
            },
            Detail = e.Detail
        }));
        return timeline.OrderBy(t => t.At).ToList();
    }

    // =====================================================================
    //  BỎ PHIẾU (quy tắc 4 mắt)
    // =====================================================================

    public async Task<ReleaseCaseDto> VoteAsync(Guid id, CastVoteInput input)
    {
        var r = await _releases.GetWithDetailsAsync(id, AsyncExecuter);
        var (stage, blocked) = await GetMyVoteStageAsync(r);
        if (stage == 0)
        {
            if (CurrentUser.IsInRole(DeathNoteConsts.Roles.SuperAdmin)) throw new BusinessException(DeathNoteErrorCodes.SuperAdminCannotApprove);
            if (r.CurrentReviewStage == 0) throw new BusinessException(DeathNoteErrorCodes.ReleaseNotReviewable);
            if (r.Votes.Any(v => v.Round == r.ReviewRound && v.AdminUserId == UserId)) throw new BusinessException(DeathNoteErrorCodes.SameAdminCannotVoteTwice);
            throw new AbpAuthorizationException(blocked);
        }

        r.CastVote(GuidGenerator.Create(), UserId, CurrentUserDisplayName, input.Decision, input.Note, Clock.Now, _policy.FinalWait);
        await _releases.UpdateAsync(r, autoSave: true);
        await _releaseManager.AfterVoteAsync(r, r.Votes.OrderByDescending(v => v.VotedAt).First());
        return await BuildCaseAsync(r);
    }

    /// <summary>
    /// Người đang xem được bỏ phiếu ở giai đoạn nào? Chặn: super admin; không đúng quyền của giai đoạn;
    /// đã bỏ phiếu trong vòng này (một người không được bỏ cả 2 phiếu).
    /// </summary>
    private async Task<(int Stage, string? BlockedReason)> GetMyVoteStageAsync(ReleaseRequest r)
    {
        var stage = r.CurrentReviewStage;
        if (stage == 0) return (0, "Hồ sơ không ở giai đoạn thẩm định.");
        if (CurrentUser.IsInRole(DeathNoteConsts.Roles.SuperAdmin))
            return (0, "Quản trị hệ thống không có quyền duyệt mở vault (tách quyền quản trị khỏi quyền quyết định).");
        if (r.Votes.Any(v => v.Round == r.ReviewRound && v.AdminUserId == UserId))
            return (0, "Bạn đã bỏ phiếu ở vòng này — phiếu còn lại phải do người khác thực hiện.");
        var permission = stage == 1 ? DeathNotePermissions.Releases.Review : DeathNotePermissions.Releases.Approve;
        if (!await AuthorizationService.IsGrantedAsync(permission))
            return (0, stage == 1 ? "Đang chờ phiếu thẩm định (vai trò Reviewer)." : "Đang chờ phiếu phê duyệt (vai trò Approver).");
        return (stage, null);
    }

    // =====================================================================
    //  BẰNG CHỨNG
    // =====================================================================

    /// <summary>Tải tệp bằng chứng. Cần quyền riêng (Support không có) và mọi lượt xem đều vào audit log.</summary>
    [Authorize(DeathNotePermissions.Releases.Evidence)]
    public async Task<IRemoteStreamContent> GetEvidenceFileAsync(Guid evidenceId)
    {
        var query = await _releases.WithDetailsAsync(x => x.Evidence);
        var request = await AsyncExecuter.FirstOrDefaultAsync(query.Where(r => r.Evidence.Any(e => e.Id == evidenceId)))
                      ?? throw new EntityNotFoundException(typeof(ReleaseEvidence), evidenceId);
        var evidence = request.Evidence.First(e => e.Id == evidenceId);
        if (evidence.PurgedAt != null) throw new EntityNotFoundException(typeof(ReleaseEvidence), evidenceId);

        await Audit.RecordAsync(new AuditEntry(AuditActions.EvidenceViewed, request.OwnerId, ActorType: AuditActorType.Admin,
            ActorUserId: UserId, ActorName: CurrentUserDisplayName, TargetType: nameof(ReleaseEvidence), TargetId: evidenceId.ToString(),
            Detail: evidence.FileName));

        var stream = await _evidenceBlobs.GetAsync(evidence.BlobName);
        return new RemoteStreamContent(stream, evidence.FileName, evidence.ContentType);
    }

    private DateTime? SlaDue(ReleaseRequest r) =>
        r.Status is ReleaseStatus.AwaitingFirstReview or ReleaseStatus.AwaitingSecondReview && r.ReviewRequestedAt.HasValue
            ? r.ReviewRequestedAt.Value + _policy.Days(_policy.Options.ReviewSlaDays)
            : null;
}
