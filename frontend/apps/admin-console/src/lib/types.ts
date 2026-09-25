/**
 * Kiểu phụ cho Admin Console, suy ra trực tiếp từ OpenAPI (không tự định nghĩa lại DTO).
 * Nhờ vậy khi backend đổi hợp đồng API, `pnpm gen:api` + typecheck sẽ báo lỗi ngay tại đây.
 */
import type { components, ReleaseCaseDto } from '@deathnote/api';

type S = components['schemas'];

export type CaseOwnerDto = S['Admin.CaseOwnerDto'];
export type CaseConsentDto = S['Admin.CaseConsentDto'];
export type CaseTrusteeDto = S['Admin.CaseTrusteeDto'];
export type CaseEvidenceDto = S['Admin.CaseEvidenceDto'];
export type DecisionSummaryDto = S['Admin.DecisionSummaryDto'];
export type StateCountDto = S['Admin.StateCountDto'];
export type CastVoteInput = S['Admin.CastVoteInput'];

/** Tab của hàng chờ — khớp `GetReleaseQueueInput.Tab` ở backend. */
export type QueueTab = 'pending' | 'consent' | 'closed' | 'all';

/** Giai đoạn phiếu mà người đang xem được phép bỏ: 0 = không được, 1 = thẩm định, 2 = phê duyệt. */
export type VoteStage = NonNullable<ReleaseCaseDto['myVoteStage']>;
