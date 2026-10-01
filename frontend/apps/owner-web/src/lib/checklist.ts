/**
 * Nhãn tiếng Việt cho loại hạng mục (VaultItemKind) và bộ sinh checklist việc cần làm cho gia đình.
 *
 * Loại hạng mục nằm TRONG ciphertext (server không biết) — nên phần này chỉ chạy sau khi đã giải mã.
 */
import type { VaultItemData, VaultItemKind } from '@deathnote/crypto';

export const itemKindLabel: Record<VaultItemKind, string> = {
  account: 'Tài khoản & mật khẩu',
  document: 'Tài liệu / giấy tờ',
  letter: 'Thư & lời nhắn',
  instruction: 'Hướng dẫn cho gia đình',
  real_estate: 'Bất động sản / xe / tài sản',
  bank: 'Tài khoản ngân hàng',
  insurance: 'Bảo hiểm & BHXH',
  investment: 'Đầu tư',
  debt: 'Khoản vay / nợ',
  subscription: 'Thanh toán định kỳ cần huỷ',
};

/** Thứ tự hiển thị nhóm trong "Bản đồ tài sản": lời nhắn trước, rồi tài chính, rồi phần còn lại. */
export const kindDisplayOrder: VaultItemKind[] = [
  'letter', 'instruction', 'bank', 'insurance', 'investment', 'debt', 'real_estate', 'document', 'account', 'subscription',
];

/**
 * Thứ tự ưu tiên trong checklist (số nhỏ = làm trước). Lý do:
 *  1. Bảo hiểm — thường có thời hạn báo sự kiện; chậm có thể mất quyền lợi.
 *  2. Ngân hàng — cần phong toả/khai báo sớm để tránh giao dịch trái phép.
 *  3. Khoản vay — lãi phạt phát sinh theo ngày.
 *  4. Thanh toán định kỳ — mỗi tháng chậm là mất thêm tiền.
 *  5. Đầu tư, tài sản — thủ tục dài hơi, không gấp từng ngày.
 *  6. Tài khoản online — xử lý sau cùng.
 */
const kindPriority: Partial<Record<VaultItemKind, number>> = {
  insurance: 1, bank: 2, debt: 3, subscription: 4, investment: 5, real_estate: 6, account: 7,
};

const taskTemplate: Partial<Record<VaultItemKind, (title: string) => string>> = {
  bank: (t) => `Liên hệ ngân hàng: ${t}`,
  insurance: (t) => `Báo cho bảo hiểm: ${t}`,
  subscription: (t) => `Huỷ thanh toán định kỳ: ${t}`,
  debt: (t) => `Xử lý khoản vay: ${t}`,
  account: (t) => `Xử lý tài khoản online: ${t}`,
  real_estate: (t) => `Làm thủ tục tài sản: ${t}`,
  investment: (t) => `Kiểm tra khoản đầu tư: ${t}`,
};

export type ChecklistTask = { id: string; text: string; kind: VaultItemKind; priority: number };

/**
 * Sinh checklist từ các hạng mục đã giải mã. Nếu owner đã ghi sẵn `todo` thì ưu tiên dùng lời của owner.
 * Thư, tài liệu, hướng dẫn không sinh việc (trừ khi có `todo`).
 */
export function buildChecklist(items: { id: string; data: VaultItemData }[]): ChecklistTask[] {
  const tasks: ChecklistTask[] = [];
  for (const { id, data } of items) {
    const tpl = taskTemplate[data.kind];
    const todo = data.todo?.trim();
    if (!todo && !tpl) continue;
    tasks.push({
      id,
      text: todo || tpl!(data.title),
      kind: data.kind,
      priority: kindPriority[data.kind] ?? 8,
    });
  }
  return tasks.sort((a, b) => a.priority - b.priority || a.text.localeCompare(b.text, 'vi'));
}

/** Lưu trạng thái tích checklist — CHỈ lưu id + true/false, không lưu nội dung hạng mục. */
const checklistKey = (trusteeId: string) => `dn.trustee.checklist.${trusteeId}`;

export function loadChecklist(trusteeId: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(checklistKey(trusteeId));
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object') return {};
    // Lọc chặt: chỉ nhận cặp string → boolean.
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter(([, v]) => typeof v === 'boolean')) as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function saveChecklist(trusteeId: string, state: Record<string, boolean>) {
  try {
    localStorage.setItem(checklistKey(trusteeId), JSON.stringify(state));
  } catch {
    /* trình duyệt chặn storage — checklist vẫn hoạt động trong phiên */
  }
}
