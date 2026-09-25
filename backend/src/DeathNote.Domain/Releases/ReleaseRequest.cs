using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace DeathNote.Releases;

/// <summary>
/// Yêu cầu mở vault — hồ sơ mà đội thẩm định PICO xử lý (giống hồ sơ bồi thường bảo hiểm).
/// <para><b>Bốn cổng độc lập, thiếu cổng nào cũng không mở:</b></para>
/// <list type="number">
/// <item><b>Thời gian</b> — owner im lặng hết Missed + Grace (kiểm tra trước khi tạo yêu cầu) và hết FinalWait.</item>
/// <item><b>Con người</b> — đủ m người giữ khoá độc lập đồng thuận (<see cref="AddConsent"/>).</item>
/// <item><b>Bằng chứng</b> — giấy tờ bên ngoài được thẩm định viên duyệt 2 phiếu (<see cref="CastVote"/>).</item>
/// <item><b>Mật mã</b> — mỗi người đồng thuận phải chuyển mảnh khoá của mình (đã niêm phong lại cho từng trustee khác);
/// server không bao giờ có đủ thông tin để tự ghép khoá.</item>
/// </list>
/// Owner có thể huỷ ở BẤT KỲ bước nào trước <see cref="ReleaseStatus.Released"/>.
/// </summary>
public class ReleaseRequest : FullAuditedAggregateRoot<Guid>
{
    public Guid OwnerId { get; private set; }
    public Guid InitiatorTrusteeId { get; private set; }
    public ReleaseReason Reason { get; private set; }
    /// <summary>Lời khai của người khởi tạo (có chịu trách nhiệm pháp lý).</summary>
    public string? Statement { get; private set; }
    public ReleaseStatus Status { get; private set; }

    /// <summary>Ngưỡng m tại thời điểm tạo yêu cầu (chốt lại, không bị ảnh hưởng nếu owner đổi cấu hình sau đó).</summary>
    public int RequiredConsents { get; private set; }
    /// <summary>Phiên bản bộ mảnh khoá áp dụng cho yêu cầu này.</summary>
    public int KeyVersion { get; private set; }

    public DateTime InitiatedAt { get; private set; }
    public DateTime? ReviewRequestedAt { get; private set; }
    /// <summary>Vòng thẩm định — tăng mỗi khi thẩm định viên yêu cầu bổ sung và trustee gửi lại.</summary>
    public int ReviewRound { get; private set; } = 1;
    public string? InfoRequestNote { get; private set; }
    public DateTime? FinalWaitUntil { get; private set; }
    public DateTime? ReleasedAt { get; private set; }
    public DateTime? ClosedAt { get; private set; }
    public string? CloseNote { get; private set; }

    public ICollection<ReleaseConsent> Consents { get; private set; } = new List<ReleaseConsent>();
    public ICollection<ShareDelivery> ShareDeliveries { get; private set; } = new List<ShareDelivery>();
    public ICollection<ReleaseEvidence> Evidence { get; private set; } = new List<ReleaseEvidence>();
    public ICollection<ReviewVote> Votes { get; private set; } = new List<ReviewVote>();

    protected ReleaseRequest() { }

    public ReleaseRequest(Guid id, Guid ownerId, Guid initiatorTrusteeId, ReleaseReason reason, string? statement,
        int requiredConsents, int keyVersion, DateTime now) : base(id)
    {
        OwnerId = ownerId;
        InitiatorTrusteeId = initiatorTrusteeId;
        Reason = reason;
        Statement = statement?.Length > 4000 ? statement[..4000] : statement;
        RequiredConsents = Math.Max(1, requiredConsents);
        KeyVersion = keyVersion;
        InitiatedAt = now;
        Status = ReleaseStatus.AwaitingConsent;
    }

    /// <summary>Yêu cầu còn đang chạy (chưa phát hành / từ chối / bị owner huỷ).</summary>
    public bool IsOpen => Status is not (ReleaseStatus.Released or ReleaseStatus.Rejected or ReleaseStatus.CancelledByOwner);

    // =====================================================================
    //  Cổng CON NGƯỜI + MẬT MÃ: đồng thuận m-of-n
    // =====================================================================

    /// <summary>
    /// Một người giữ khoá xác nhận đồng thuận, đồng thời chuyển mảnh khoá của mình
    /// (đã niêm phong lại cho từng trustee nhận) — đồng thuận chính là hành động mật mã.
    /// </summary>
    /// <returns>True nếu lần đồng thuận này làm yêu cầu đủ ngưỡng và chuyển sang chờ thẩm định.</returns>
    public bool AddConsent(Guid consentId, Guid trusteeId, string? ip, string? userAgent, string? statement,
        IReadOnlyCollection<(Guid ToTrusteeId, string SealedShare)> deliveries, DateTime now, bool enforceDistinctIp)
    {
        EnsureOpen();
        if (Status != ReleaseStatus.AwaitingConsent)
            throw new BusinessException(DeathNoteErrorCodes.ReleaseNotAllowedInState);
        if (Consents.Any(c => c.TrusteeId == trusteeId))
            throw new BusinessException(DeathNoteErrorCodes.AlreadyConsented);

        Consents.Add(new ReleaseConsent(consentId, Id, trusteeId, now, ip, userAgent, statement));
        foreach (var (to, sealedShare) in deliveries)
        {
            ShareDeliveries.Add(new ShareDelivery(Guid.NewGuid(), Id, trusteeId, to, sealedShare, now));
        }

        if (EffectiveConsentCount(enforceDistinctIp) >= RequiredConsents)
        {
            Status = ReleaseStatus.AwaitingFirstReview;
            ReviewRequestedAt = now;
            return true;
        }
        return false;
    }

    /// <summary>
    /// Số phiếu đồng thuận được tính vào ngưỡng. Khi bật chống gian lận, các phiếu cùng IP chỉ tính là một
    /// (tài liệu: "Đồng thuận từ cùng IP/thiết bị bị gắn cờ và không tính đủ trọng số").
    /// </summary>
    public int EffectiveConsentCount(bool enforceDistinctIp)
    {
        if (!enforceDistinctIp) return Consents.Count;
        var withIp = Consents.Where(c => !string.IsNullOrEmpty(c.IpAddress)).Select(c => c.IpAddress).Distinct().Count();
        var withoutIp = Consents.Count(c => string.IsNullOrEmpty(c.IpAddress));
        return withIp + withoutIp;
    }

    // =====================================================================
    //  Cổng BẰNG CHỨNG
    // =====================================================================

    public ReleaseEvidence AddEvidence(Guid id, Guid trusteeId, EvidenceKind kind, string fileName, string contentType,
        long sizeBytes, string blobName, DateTime now)
    {
        EnsureOpen();
        if (sizeBytes > DeathNoteConsts.MaxEvidenceFileBytes) throw new BusinessException(DeathNoteErrorCodes.EvidenceTooLarge);
        var evidence = new ReleaseEvidence(id, Id, trusteeId, kind, fileName, contentType, sizeBytes, blobName, now);
        Evidence.Add(evidence);
        return evidence;
    }

    /// <summary>Trustee gửi lại hồ sơ sau khi đã bổ sung bằng chứng theo yêu cầu của thẩm định viên.</summary>
    public void ResubmitForReview(DateTime now)
    {
        if (Status != ReleaseStatus.NeedsMoreInfo) throw new BusinessException(DeathNoteErrorCodes.ReleaseNotReviewable);
        ReviewRound++;
        Status = ReleaseStatus.AwaitingFirstReview;
        ReviewRequestedAt = now;
    }

    // =====================================================================
    //  Thẩm định 4 mắt (two-person rule)
    // =====================================================================

    /// <summary>Phiếu hiện tại là phiếu thứ mấy (1 = Reviewer, 2 = Approver).</summary>
    public int CurrentReviewStage => Status switch
    {
        ReleaseStatus.AwaitingFirstReview => 1,
        ReleaseStatus.AwaitingSecondReview => 2,
        _ => 0
    };

    /// <summary>
    /// Bỏ phiếu thẩm định. Quy tắc:
    /// <list type="bullet">
    /// <item>Phiếu 1 "Duyệt" → chờ phiếu 2; phiếu 2 "Duyệt" → FinalWait (vẫn còn thời gian chờ cuối).</item>
    /// <item>Cùng một người không được bỏ cả hai phiếu trong một vòng.</item>
    /// <item>"Yêu cầu bổ sung" → trustee nộp thêm bằng chứng rồi bắt đầu vòng mới.</item>
    /// <item>"Từ chối" → đóng yêu cầu.</item>
    /// </list>
    /// Kiểm tra quyền (Reviewer/Approver, cấm Super admin) do application service thực hiện.
    /// </summary>
    public void CastVote(Guid voteId, Guid adminUserId, string adminName, ReviewDecision decision, string? note,
        DateTime now, TimeSpan finalWait)
    {
        var stage = CurrentReviewStage;
        if (stage == 0) throw new BusinessException(DeathNoteErrorCodes.ReleaseNotReviewable);
        if (Votes.Any(v => v.Round == ReviewRound && v.AdminUserId == adminUserId))
            throw new BusinessException(DeathNoteErrorCodes.SameAdminCannotVoteTwice);

        Votes.Add(new ReviewVote(voteId, Id, adminUserId, adminName, ReviewRound, stage, decision, note, now));

        switch (decision)
        {
            case ReviewDecision.Reject:
                Close(ReleaseStatus.Rejected, note, now);
                break;
            case ReviewDecision.RequestMoreInfo:
                Status = ReleaseStatus.NeedsMoreInfo;
                InfoRequestNote = note;
                break;
            case ReviewDecision.Approve when stage == 1:
                Status = ReleaseStatus.AwaitingSecondReview;
                break;
            case ReviewDecision.Approve:
                Status = ReleaseStatus.FinalWait;
                FinalWaitUntil = now + finalWait;
                break;
        }
    }

    // =====================================================================
    //  Kết thúc
    // =====================================================================

    /// <summary>Hết thời gian chờ cuối? (worker sẽ gọi <see cref="Complete"/>).</summary>
    public bool IsFinalWaitOver(DateTime now) => Status == ReleaseStatus.FinalWait && FinalWaitUntil <= now;

    /// <summary>Phát hành: từ giờ trustee tải được các mảnh khoá gửi cho mình và tự ghép trên thiết bị.</summary>
    public void Complete(DateTime now)
    {
        if (!IsFinalWaitOver(now)) throw new BusinessException(DeathNoteErrorCodes.ReleaseNotAllowedInState);
        Status = ReleaseStatus.Released;
        ReleasedAt = now;
        ClosedAt = now;
    }

    /// <summary>Owner phủ quyết (check-in / bấm huỷ) — dừng ngay, ở bất kỳ bước nào.</summary>
    public void CancelByOwner(DateTime now) => Close(ReleaseStatus.CancelledByOwner, "Owner đã xác thực và huỷ tiến trình.", now);

    public void MarkEvidencePurged(DateTime now)
    {
        foreach (var e in Evidence.Where(e => e.PurgedAt == null)) e.MarkPurged(now);
    }

    private void Close(ReleaseStatus status, string? note, DateTime now)
    {
        EnsureOpen();
        Status = status;
        CloseNote = note;
        ClosedAt = now;
    }

    private void EnsureOpen()
    {
        if (!IsOpen) throw new BusinessException(DeathNoteErrorCodes.ReleaseClosed);
    }
}
