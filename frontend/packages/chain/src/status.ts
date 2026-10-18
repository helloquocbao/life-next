import { maxPrepaySeconds, monthSeconds, overdueSeconds, type ChainConfig } from './config';

/** Trạng thái hồ sơ của A, tính thuần từ `paid_until` và giờ hiện tại — y như chương trình on-chain. */
export type OwnerPhase = 'active' | 'overdue' | 'released';

export type OwnerStatus = {
  phase: OwnerPhase;
  paidUntil: number;
  /** Mốc bàn giao nếu A không trả tiếp. */
  releaseAt: number;
  /** Số tháng tối đa A còn trả trước được ngay lúc này (0 = đã chạm giới hạn 90 ngày). */
  maxMonthsNow: number;
  /** Số tháng tối thiểu để không còn quá hạn (≥ 1). */
  minMonthsNow: number;
};

export function ownerStatus(cfg: Pick<ChainConfig, 'demoTime'>, paidUntil: number, now: number): OwnerStatus {
  const month = monthSeconds(cfg);
  const releaseAt = paidUntil + overdueSeconds(cfg);
  const phase: OwnerPhase = now < paidUntil ? 'active' : now < releaseAt ? 'overdue' : 'released';
  // Khớp `handle_pay`: paid_until + m·tháng phải > now và ≤ now + 90 ngày.
  const minMonthsNow = Math.max(1, Math.floor((now - paidUntil) / month) + 1);
  const maxMonthsNow = Math.max(0, Math.floor((now + maxPrepaySeconds(cfg) - paidUntil) / month));
  return { phase, paidUntil, releaseAt, maxMonthsNow, minMonthsNow };
}
