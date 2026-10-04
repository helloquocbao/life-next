/**
 * Tên kiểu thân thiện cho các DTO sinh tự động từ OpenAPI của backend (schema.d.ts).
 * Khi backend đổi API: chạy `pnpm gen:api` là mọi app được kiểm tra kiểu lại ngay.
 */
import type { components } from './schema';

type S = components['schemas'];

// Owner
export type OwnerStatusDto = S['Owners.OwnerStatusDto'];
export type ReadinessCheckDto = S['Owners.ReadinessCheckDto'];
export type OpenReleaseSummaryDto = S['Owners.OpenReleaseSummaryDto'];
export type CompleteOnboardingInput = S['Owners.CompleteOnboardingInput'];
export type CheckInResultDto = S['Owners.CheckInResultDto'];
export type CheckInByLinkResultDto = S['Owners.CheckInByLinkResultDto'];
export type HeartbeatDto = S['Owners.HeartbeatDto'];
export type DryRunDto = S['Owners.DryRunDto'];
export type DryRunStepDto = S['Owners.DryRunStepDto'];
export type TwoFactorSetupDto = S['Owners.TwoFactorSetupDto'];
export type AuditEventDto = S['Common.AuditEventDto'];

// Vault
export type VaultDto = S['Vaults.VaultDto'];
export type VaultItemDto = S['Vaults.VaultItemDto'];
export type SaveVaultItemInput = S['Vaults.SaveVaultItemInput'];
export type DistributeKeysInput = S['Vaults.DistributeKeysInput'];

// Trustee (phía owner)
export type TrusteeDto = S['Trustees.TrusteeDto'];
export type SaveTrusteeInput = S['Trustees.SaveTrusteeInput'];

// Trustee portal
export type InvitationDto = S['TrusteePortal.InvitationDto'];
export type KeyringDto = S['TrusteePortal.KeyringDto'];
export type AssignmentDto = S['TrusteePortal.AssignmentDto'];
export type InboxDto = S['TrusteePortal.InboxDto'];
export type ReleasedItemDto = S['TrusteePortal.ReleasedItemDto'];

// Admin
export type AdminProfileDto = S['Admin.AdminProfileDto'];
export type AdminDashboardDto = S['Admin.AdminDashboardDto'];
export type ReleaseQueueItemDto = S['Admin.ReleaseQueueItemDto'];
export type ReleaseCaseDto = S['Admin.ReleaseCaseDto'];
export type GateDto = S['Admin.GateDto'];
export type TimelineEntryDto = S['Admin.TimelineEntryDto'];
export type RiskFlagDto = S['Admin.RiskFlagDto'];
export type ReviewVoteDto = S['Admin.ReviewVoteDto'];
export type ChainVerificationDto = S['Admin.ChainVerificationDto'];
export type PolicyDto = S['Admin.PolicyDto'];
export type EmailTemplateDto = S['EmailTemplates.EmailTemplateDto'];
export type EmailTemplatePlaceholderDto = S['EmailTemplates.EmailTemplatePlaceholderDto'];
export type UpdateEmailTemplateInput = S['EmailTemplates.UpdateEmailTemplateInput'];
export type EmailPreviewDto = S['EmailTemplates.EmailPreviewDto'];
export type EmailDeliveryInfoDto = S['EmailTemplates.EmailDeliveryInfoDto'];

// ---------------------------------------------------------------------------
//  Enum — backend serialize enum thành số; các hằng dưới đây đặt tên cho dễ đọc.
//  PHẢI khớp thứ tự với enum C# trong DeathNote.Domain.Shared.
// ---------------------------------------------------------------------------

export const LifecycleState = { Active: 0, Missed: 1, Grace: 2, Verifying: 3, Review: 4, FinalWait: 5, Released: 6 } as const;
export type LifecycleState = S['Lifecycle.LifecycleState'];

export const CheckInChannel = { MobileApp: 0, Web: 1, EmailLink: 2, SmsLink: 3 } as const;
export type CheckInChannel = S['Lifecycle.CheckInChannel'];

/** Recipient: tự động nhận phần owner phân sau khi hết ân hạn. Reminder: được báo trước, nhiệm vụ nhắc owner bấm "Tôi vẫn ổn". */
export const TrusteeRole = { Recipient: 1, Reminder: 2 } as const;
export type TrusteeRole = S['Trustees.TrusteeRole'];

export const TrusteeStatus = { Pending: 0, Confirmed: 1, Unresponsive: 2, NotInvitedYet: 3 } as const;
export type TrusteeStatus = S['Trustees.TrusteeStatus'];

export const ContactResponse = { CanReach: 0, CannotReach: 1 } as const;
export type ContactResponse = S['Trustees.ContactResponse'];

export const TrusteePhase = { Normal: 0, Alert: 1, Released: 2 } as const;
export type TrusteePhase = S['TrusteePortal.TrusteePhase'];

export const ReleaseReason = { LostContact: 0, Hospitalized: 1, Accident: 2, Deceased: 3 } as const;
export type ReleaseReason = S['Releases.ReleaseReason'];

export const ReleaseStatus = {
  AwaitingConsent: 0,
  AwaitingFirstReview: 1,
  AwaitingSecondReview: 2,
  NeedsMoreInfo: 3,
  FinalWait: 4,
  Released: 5,
  Rejected: 6,
  CancelledByOwner: 7,
} as const;
export type ReleaseStatus = S['Releases.ReleaseStatus'];

export const ReviewDecision = { Approve: 0, RequestMoreInfo: 1, Reject: 2 } as const;
export type ReviewDecision = S['Releases.ReviewDecision'];

export const EvidenceKind = { DeathCertificate: 0, HospitalRecord: 1, IdentityDocument: 2, SignedStatement: 3, Other: 9 } as const;
export type EvidenceKind = S['Releases.EvidenceKind'];

export const RiskSeverity = { Low: 0, Medium: 1, High: 2 } as const;
export type RiskSeverity = S['Releases.RiskSeverity'];

export const AuditActorType = { System: 0, Owner: 1, Trustee: 2, Admin: 3, Anonymous: 4 } as const;
export type AuditActorType = S['AuditTrail.AuditActorType'];
