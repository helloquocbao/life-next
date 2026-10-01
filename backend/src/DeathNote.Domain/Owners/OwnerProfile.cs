using DeathNote.Lifecycle;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace DeathNote.Owners;

/// <summary>
/// Hồ sơ của người uỷ quyền (owner) và STATE MACHINE vòng đời — aggregate quan trọng nhất hệ thống.
/// <para>
/// Id của hồ sơ trùng với Id tài khoản đăng nhập (AbpUsers.Id): mỗi người dùng có tối đa một hồ sơ owner.
/// </para>
/// <para>
/// Mọi thay đổi trạng thái đều đi qua các phương thức có tên nghiệp vụ rõ ràng (CheckIn, MarkMissed,
/// EnterGrace…). Không có setter công khai cho <see cref="State"/> — không ai có thể "nhảy cóc"
/// sang <see cref="LifecycleState.Released"/>.
/// </para>
/// </summary>
public class OwnerProfile : FullAuditedAggregateRoot<Guid>
{
    // ----- Thông tin liên hệ (dùng để gửi nhắc nhở; KHÔNG phải nội dung vault) -----
    public string DisplayName { get; private set; } = default!;
    public string Email { get; private set; } = default!;
    public string? PhoneNumber { get; private set; }
    /// <summary>Lần gần nhất đổi email/số điện thoại — dùng cho cờ rủi ro "vừa đổi thông tin liên hệ".</summary>
    public DateTime? ContactInfoChangedAt { get; private set; }

    // ----- Cấu hình nhịp sống -----
    /// <summary>Nhịp check-in: 7 / 14 / 30 / 90 ngày.</summary>
    public int CheckInIntervalDays { get; private set; }
    /// <summary>Thời gian ân hạn (7–30 ngày) sau khi đã báo người thân, trước khi họ được phép yêu cầu mở.</summary>
    public int GraceDays { get; private set; }

    // ----- Trạng thái vòng đời -----
    public LifecycleState State { get; private set; }
    public DateTime StateChangedAt { get; private set; }
    public DateTime? LastCheckInAt { get; private set; }
    /// <summary>Hạn check-in kế tiếp. Home screen hiển thị đếm ngược tới mốc này.</summary>
    public DateTime NextCheckInDueAt { get; private set; }
    /// <summary>Số vòng nhắc đã gửi trong giai đoạn Missed hiện tại.</summary>
    public int RemindersSent { get; private set; }
    public DateTime? LastReminderAt { get; private set; }
    /// <summary>Thời điểm bắt đầu Grace — dùng tính mốc trustee được phép khởi tạo yêu cầu mở.</summary>
    public DateTime? GraceStartedAt { get; private set; }

    // ----- Chế độ tạm dừng (du lịch / nhập viện) -----
    public DateTime? PausedUntil { get; private set; }
    public string? PauseReason { get; private set; }

    // ----- Mức độ sẵn sàng -----
    /// <summary>Owner đã xác nhận đã cất giữ 12 từ khôi phục (recovery kit).</summary>
    public bool RecoveryKitConfirmed { get; private set; }
    /// <summary>
    /// Đã bật xác thực hai lớp (TOTP) khi MỞ KÉT. Khi bật, sau khi giải mã VaultKey bằng passphrase
    /// trên trình duyệt, owner còn phải nhập thêm mã 6 số mới thực sự xem được nội dung — một lớp
    /// phòng vệ bổ sung tại đúng thời điểm nhạy cảm nhất (đọc dữ liệu đã giải mã).
    /// </summary>
    public bool VaultUnlockTwoFactorEnabled { get; private set; }

    /// <summary>
    /// Tuỳ chọn TRẢ PHÍ ĐỊNH KỲ: khi owner đến hạn (Missed), ngoài email/SMS tự động, nhân viên PICO
    /// sẽ chủ động gọi điện liên hệ thêm. MVP: chỉ lưu cờ bật/tắt, chưa có luồng thanh toán/vận hành thật.
    /// </summary>
    public bool StaffContactOnMissed { get; private set; }

    /// <summary>
    /// Nonce của link check-in qua email/SMS. Mỗi lần gửi nhắc sẽ sinh nonce mới và link cũ hết hiệu lực,
    /// tránh việc kẻ xấu dùng lại một link cũ để "giữ owner còn sống" mãi mãi.
    /// </summary>
    public string CheckInLinkNonce { get; private set; } = default!;

    protected OwnerProfile() { }

    public OwnerProfile(
        Guid userId,
        string displayName,
        string email,
        string? phoneNumber,
        int checkInIntervalDays,
        int graceDays,
        DateTime now,
        LifecyclePolicy policy) : base(userId)
    {
        SetContact(displayName, email, phoneNumber, now, isInitial: true);
        SetSchedule(checkInIntervalDays, graceDays, policy);
        State = LifecycleState.Active;
        StateChangedAt = now;
        LastCheckInAt = now;
        NextCheckInDueAt = now + policy.Days(CheckInIntervalDays);
        RotateCheckInLinkNonce();
    }

    // =====================================================================
    //  Hành động của OWNER
    // =====================================================================

    /// <summary>
    /// "Tôi vẫn ổn". Luôn thành công ở mọi trạng thái trừ Released.
    /// <para>
    /// Nếu hồ sơ đang ở bất kỳ giai đoạn cảnh báo/xác minh nào, check-in chính là QUYỀN PHỦ QUYẾT
    /// của owner: toàn bộ tiến trình bị huỷ và quay về Active.
    /// </para>
    /// </summary>
    /// <returns>Trạng thái trước khi check-in (để tầng trên biết có phải là một lần phủ quyết hay không).</returns>
    public LifecycleState CheckIn(DateTime now, LifecyclePolicy policy)
    {
        EnsureNotReleased();
        var previous = State;

        LastCheckInAt = now;
        NextCheckInDueAt = now + policy.Days(CheckInIntervalDays);
        ResetEscalation();
        if (State != LifecycleState.Active)
        {
            ChangeState(LifecycleState.Active, now);
        }
        RotateCheckInLinkNonce();
        return previous;
    }

    /// <summary>Đổi nhịp check-in / thời gian ân hạn. Hạn kế tiếp tính lại từ lần check-in gần nhất.</summary>
    public void UpdateSchedule(int checkInIntervalDays, int graceDays, LifecyclePolicy policy)
    {
        EnsureNotReleased();
        SetSchedule(checkInIntervalDays, graceDays, policy);
        var baseline = LastCheckInAt ?? StateChangedAt;
        NextCheckInDueAt = baseline + policy.Days(CheckInIntervalDays);
    }

    public void UpdateContact(string displayName, string email, string? phoneNumber, DateTime now)
    {
        EnsureNotReleased();
        SetContact(displayName, email, phoneNumber, now, isInitial: false);
    }

    /// <summary>
    /// Chế độ tạm dừng có thời hạn (ví dụ "tôi đi nước ngoài 3 tuần"). Tự hết hạn,
    /// không dùng được vô thời hạn. Chỉ bật được khi đang Active (tức là owner đang chủ động dùng app).
    /// </summary>
    public void Pause(DateTime until, string? reason, DateTime now, LifecyclePolicy policy)
    {
        EnsureNotReleased();
        var max = policy.Options.MaxPauseDays;
        if (until <= now || until - now > policy.Days(max))
        {
            throw new BusinessException(DeathNoteErrorCodes.PauseTooLong).WithData("MaxDays", max);
        }
        PausedUntil = until;
        PauseReason = reason;
        // Trong thời gian tạm dừng, hạn check-in được dời tới sau ngày trở về.
        if (NextCheckInDueAt < until) NextCheckInDueAt = until + policy.Days(1);
    }

    public void Resume()
    {
        PausedUntil = null;
        PauseReason = null;
    }

    public void ConfirmRecoveryKit() => RecoveryKitConfirmed = true;

    public void SetVaultUnlockTwoFactor(bool enabled) => VaultUnlockTwoFactorEnabled = enabled;

    public void SetStaffContactOnMissed(bool enabled) => StaffContactOnMissed = enabled;

    /// <summary>
    /// Owner quên cả mật khẩu chính lẫn 12 từ khôi phục — từ bỏ két cũ để tạo két mới.
    /// Chỉ reset lại "đã xác nhận cất giữ recovery kit" (két mới sẽ có bộ 12 từ mới, cần xác nhận lại);
    /// không đổi trạng thái vòng đời hay danh sách người được uỷ quyền — họ vẫn được owner tin tưởng,
    /// chỉ là owner cần phân mảnh khoá lại từ đầu khi có két mới.
    /// </summary>
    public void ResetForNewVault() => RecoveryKitConfirmed = false;

    // =====================================================================
    //  Chuyển trạng thái do HỆ THỐNG thực hiện (background worker / quy trình mở)
    // =====================================================================

    public bool IsPaused(DateTime now) => PausedUntil.HasValue && PausedUntil.Value > now;

    /// <summary>Đã quá hạn check-in và không trong chế độ tạm dừng.</summary>
    public bool IsCheckInOverdue(DateTime now) =>
        State == LifecycleState.Active && !IsPaused(now) && now >= NextCheckInDueAt;

    /// <summary>Active → Missed. Bắt đầu chuỗi leo thang kênh nhắc.</summary>
    public void MarkMissed(DateTime now)
    {
        EnsureState(LifecycleState.Active);
        ResetEscalation();
        ChangeState(LifecycleState.Missed, now);
    }

    /// <summary>
    /// Có cần gửi vòng nhắc tiếp theo không? Trả về chỉ số vòng (0-based) hoặc null.
    /// Vòng 0 gửi ngay khi vào Missed; các vòng sau cách nhau <see cref="LifecyclePolicy.ReminderInterval"/>.
    /// </summary>
    public int? GetDueReminderStep(DateTime now, LifecyclePolicy policy)
    {
        if (State != LifecycleState.Missed || RemindersSent >= policy.ReminderSteps) return null;
        if (LastReminderAt is null || now >= LastReminderAt.Value + policy.ReminderInterval) return RemindersSent;
        return null;
    }

    /// <summary>Ghi nhận đã gửi một vòng nhắc (và xoay nonce để link check-in cũ hết hạn).</summary>
    public void RegisterReminderSent(DateTime now)
    {
        RemindersSent++;
        LastReminderAt = now;
        RotateCheckInLinkNonce();
    }

    /// <summary>Đã gửi hết các vòng nhắc và đã chờ thêm một khoảng mà owner vẫn im lặng → sẵn sàng vào Grace.</summary>
    public bool ShouldEnterGrace(DateTime now, LifecyclePolicy policy) =>
        State == LifecycleState.Missed
        && RemindersSent >= policy.ReminderSteps
        && LastReminderAt.HasValue
        && now >= LastReminderAt.Value + policy.ReminderInterval;

    /// <summary>Missed → Grace. Người được uỷ quyền nhận thông báo mức "hãy liên lạc với owner".</summary>
    public void EnterGrace(DateTime now)
    {
        EnsureState(LifecycleState.Missed);
        GraceStartedAt = now;
        ChangeState(LifecycleState.Grace, now);
    }

    /// <summary>Mốc mà từ đó trustee được phép khởi tạo yêu cầu mở (hết thời gian ân hạn).</summary>
    public DateTime? GraceEndsAt(LifecyclePolicy policy) =>
        GraceStartedAt.HasValue ? GraceStartedAt.Value + policy.Days(GraceDays) : null;

    /// <summary>Cổng THỜI GIAN: đang Grace và đã hết thời gian ân hạn.</summary>
    public bool CanAcceptReleaseRequest(DateTime now, LifecyclePolicy policy) =>
        State == LifecycleState.Grace && GraceEndsAt(policy) is { } end && now >= end;

    /// <summary>Grace → Verifying: một trustee đã khởi tạo yêu cầu mở.</summary>
    public void EnterVerifying(DateTime now)
    {
        EnsureState(LifecycleState.Grace);
        ChangeState(LifecycleState.Verifying, now);
    }

    /// <summary>Verifying → Review: đã đủ ngưỡng đồng thuận m-of-n.</summary>
    public void EnterReview(DateTime now)
    {
        EnsureState(LifecycleState.Verifying);
        ChangeState(LifecycleState.Review, now);
    }

    /// <summary>Review → FinalWait: đội thẩm định đã duyệt đủ 2 phiếu.</summary>
    public void EnterFinalWait(DateTime now)
    {
        EnsureState(LifecycleState.Review);
        ChangeState(LifecycleState.FinalWait, now);
    }

    /// <summary>FinalWait → Released: hết thời gian chờ cuối mà owner không phủ quyết. Không thể đảo ngược.</summary>
    public void MarkReleased(DateTime now)
    {
        EnsureState(LifecycleState.FinalWait);
        ChangeState(LifecycleState.Released, now);
    }

    /// <summary>
    /// Yêu cầu mở bị từ chối → hồ sơ quay lại Grace (owner vẫn đang im lặng, nhưng dữ liệu vẫn khoá).
    /// Trustee có thể khởi tạo yêu cầu mới với bằng chứng đầy đủ hơn.
    /// </summary>
    public void ReturnToGrace(DateTime now)
    {
        if (State is LifecycleState.Verifying or LifecycleState.Review or LifecycleState.FinalWait)
        {
            ChangeState(LifecycleState.Grace, now);
        }
    }

    // =====================================================================
    //  Nội bộ
    // =====================================================================

    private void SetSchedule(int interval, int graceDays, LifecyclePolicy policy)
    {
        if (!DeathNoteConsts.AllowedCheckInIntervals.Contains(interval))
            throw new BusinessException(DeathNoteErrorCodes.InvalidCheckInInterval);
        if (graceDays < policy.Options.MinGraceDays || graceDays > policy.Options.MaxGraceDays)
            throw new BusinessException(DeathNoteErrorCodes.InvalidGraceDays);
        CheckInIntervalDays = interval;
        GraceDays = graceDays;
    }

    private void SetContact(string displayName, string email, string? phone, DateTime now, bool isInitial)
    {
        var changed = !isInitial && (!string.Equals(Email, email, StringComparison.OrdinalIgnoreCase) || PhoneNumber != phone);
        DisplayName = Check.NotNullOrWhiteSpace(displayName, nameof(displayName), 128);
        Email = Check.NotNullOrWhiteSpace(email, nameof(email), 256);
        PhoneNumber = phone;
        if (changed) ContactInfoChangedAt = now;
    }

    private void ResetEscalation()
    {
        RemindersSent = 0;
        LastReminderAt = null;
        GraceStartedAt = null;
    }

    private void ChangeState(LifecycleState next, DateTime now)
    {
        State = next;
        StateChangedAt = now;
    }

    private void RotateCheckInLinkNonce() => CheckInLinkNonce = Guid.NewGuid().ToString("N");

    private void EnsureNotReleased()
    {
        if (State == LifecycleState.Released) throw new BusinessException(DeathNoteErrorCodes.AlreadyReleased);
    }

    private void EnsureState(LifecycleState expected)
    {
        if (State != expected)
            throw new BusinessException(DeathNoteErrorCodes.ReleaseNotAllowedInState)
                .WithData("Expected", expected).WithData("Actual", State);
    }
}
