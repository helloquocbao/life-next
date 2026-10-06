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
    public const string TwoFactorDisabledViaRecovery = "owner.2fa_disabled_via_recovery";
    public const string StaffContactPreferenceChanged = "owner.staff_contact_preference_changed";

    public const string VaultInitialized = "vault.initialized";
    public const string VaultItemCreated = "vault.item_created";
    public const string VaultItemUpdated = "vault.item_updated";
    public const string VaultItemDeleted = "vault.item_deleted";
    public const string KeysDistributed = "vault.keys_distributed";
    public const string VaultAbandoned = "vault.abandoned";

    public const string TrusteeAdded = "trustee.added";
    public const string TrusteeInvited = "trustee.invited";
    public const string TrusteeUpdated = "trustee.updated";
    public const string TrusteeRemoved = "trustee.removed";
    public const string TrusteeAccepted = "trustee.accepted";
    public const string TrusteeKeyringCreated = "trustee.keyring_created";
    public const string TrusteeContactResponse = "trustee.contact_response";

    public const string StateChanged = "lifecycle.state_changed";
    public const string ReminderSent = "lifecycle.reminder_sent";
    public const string RemindersNotified = "lifecycle.reminders_notified";
    public const string AutoReleased = "lifecycle.auto_released";

    // Các hành động "release.*" của luồng mở vault thủ công cũ (khởi tạo, đồng thuận, bằng chứng, phiếu duyệt…) đã bỏ;
    // chuỗi cũ vẫn còn trong log lịch sử và vẫn có nhãn hiển thị ở admin console.
    public const string ReleasedDataAccessed = "release.data_accessed";

    public const string EmailTemplateUpdated = "admin.email_template_updated";
    public const string EmailTemplateReset = "admin.email_template_reset";
    public const string PolicyUpdated = "admin.policy_updated";
    public const string StaffCreated = "admin.staff_created";
    public const string StaffUpdated = "admin.staff_updated";
    public const string RoleCreated = "admin.role_created";
    public const string RoleUpdated = "admin.role_updated";
    public const string RoleDeleted = "admin.role_deleted";
    public const string CustomerContactViewed = "admin.customer_contact_viewed";
}
