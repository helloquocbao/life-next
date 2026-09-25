namespace DeathNote.AuditTrail;

/// <summary>
/// Danh mục hành động được ghi vào audit log bất biến. Dùng chuỗi (không dùng enum)
/// để log cũ vẫn đọc được khi thêm hành động mới.
/// </summary>
public static class AuditActions
{
    public const string OnboardingCompleted = "owner.onboarding_completed";
    public const string CheckIn = "owner.check_in";
    public const string ScheduleChanged = "owner.schedule_changed";
    public const string Paused = "owner.paused";
    public const string Resumed = "owner.resumed";
    public const string OwnerVeto = "owner.veto";
    public const string TwoFactorEnabled = "owner.2fa_enabled";

    public const string VaultInitialized = "vault.initialized";
    public const string VaultItemCreated = "vault.item_created";
    public const string VaultItemUpdated = "vault.item_updated";
    public const string VaultItemDeleted = "vault.item_deleted";
    public const string KeysDistributed = "vault.keys_distributed";

    public const string TrusteeInvited = "trustee.invited";
    public const string TrusteeUpdated = "trustee.updated";
    public const string TrusteeRemoved = "trustee.removed";
    public const string TrusteeAccepted = "trustee.accepted";
    public const string TrusteeKeyringCreated = "trustee.keyring_created";
    public const string TrusteeContactResponse = "trustee.contact_response";

    public const string StateChanged = "lifecycle.state_changed";
    public const string ReminderSent = "lifecycle.reminder_sent";

    public const string ReleaseInitiated = "release.initiated";
    public const string ReleaseConsented = "release.consented";
    public const string EvidenceUploaded = "release.evidence_uploaded";
    public const string EvidenceViewed = "release.evidence_viewed";
    public const string EvidencePurged = "release.evidence_purged";
    public const string ReviewVoteCast = "release.review_vote";
    public const string ReleaseFinalWaitStarted = "release.final_wait_started";
    public const string ReleaseCompleted = "release.completed";
    public const string ReleaseRejected = "release.rejected";
    public const string ReleaseCancelled = "release.cancelled";
    public const string ReleasedDataAccessed = "release.data_accessed";
}
