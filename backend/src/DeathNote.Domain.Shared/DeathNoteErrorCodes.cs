namespace DeathNote;

/// <summary>
/// Mã lỗi nghiệp vụ. Mỗi mã có bản dịch trong Localization/DeathNote/*.json,
/// client hiển thị trực tiếp thông báo đã dịch cho người dùng.
/// </summary>
public static class DeathNoteErrorCodes
{
    public const string OnboardingRequired = "DeathNote:00001";
    public const string InvalidCheckInInterval = "DeathNote:00002";
    public const string InvalidGraceDays = "DeathNote:00003";
    public const string AlreadyReleased = "DeathNote:00004";
    public const string TwoFactorRequired = "DeathNote:00005";
    public const string InvalidTwoFactorCode = "DeathNote:00006";
    public const string PauseTooLong = "DeathNote:00007";
    public const string InvalidCheckInLink = "DeathNote:00008";

    public const string VaultNotInitialized = "DeathNote:01001";
    public const string VaultAlreadyInitialized = "DeathNote:01002";
    public const string InvalidThreshold = "DeathNote:01003";
    public const string TrusteeKeyMissing = "DeathNote:01004";
    public const string ItemTooLarge = "DeathNote:01005";

    public const string InvitationInvalid = "DeathNote:02001";
    public const string InvitationAlreadyAccepted = "DeathNote:02002";
    public const string CannotBeOwnTrustee = "DeathNote:02003";
    public const string KeyringRequired = "DeathNote:02004";
    public const string NotATrustee = "DeathNote:02005";

    public const string ReleaseNotAllowedInState = "DeathNote:03001";
    public const string InvalidShareDeliveries = "DeathNote:03005";
    public const string RecipientNotInvitedInAdvance = "DeathNote:03007";
    public const string ReleaseNotYetReleased = "DeathNote:03009";

    public const string EmailTemplateNotFound = "DeathNote:04001";
    public const string EmailTemplateUnknownPlaceholder = "DeathNote:04002";
    public const string EmailTemplateMissingContent = "DeathNote:04003";
    public const string EmailSendFailed = "DeathNote:04004";
}
