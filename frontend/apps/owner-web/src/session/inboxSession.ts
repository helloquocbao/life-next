/**
 * Phiên hộp nhận — nội dung ĐÃ GIẢI MÃ chỉ nằm trong bộ nhớ (zustand), KHÔNG BAO GIỜ ghi xuống
 * localStorage/sessionStorage/IndexedDB.
 *
 * - Khoá riêng của trustee KHÔNG được giữ ở đây: nó chỉ tồn tại trong vài trăm mili-giây lúc mở
 *   hộp nhận rồi bị ghi đè 0 (xem lib/inbox.ts). Ở đây chỉ giữ kết quả đã giải mã để người dùng
 *   đi lại giữa Home ↔ Hộp nhận mà không phải nhập lại passphrase liên tục.
 * - Tải lại trang / đăng xuất / 10 phút không thao tác ⇒ xoá sạch, phải nhập lại passphrase.
 */
import { create } from 'zustand';
import type { GrantPayload, VaultItemData } from '@deathnote/crypto';

export const AUTO_LOCK_MS = 10 * 60 * 1000;

/** Một hạng mục sau khi giải mã: id + dữ liệu rõ (hoặc lỗi nếu không giải mã được). */
export type OpenedItem = { id: string; data?: VaultItemData; error?: string };

export type OpenedInbox = {
  ownerName: string;
  releasedAt?: string;
  grant: GrantPayload;
  items: OpenedItem[];
  /** Đã đọc thư mở đầu trong phiên này chưa (để không bắt đọc lại mỗi lần quay lại). */
  letterSeen: boolean;
};

type InboxSession = {
  inboxes: Record<string, OpenedInbox>;
  lastActivity: number;
  setInbox: (trusteeId: string, inbox: OpenedInbox) => void;
  markLetterSeen: (trusteeId: string, seen?: boolean) => void;
  lock: () => void;
  touch: () => void;
};

export const useInboxSession = create<InboxSession>((set) => ({
  inboxes: {},
  lastActivity: Date.now(),
  setInbox: (trusteeId, inbox) => set((s) => ({ inboxes: { ...s.inboxes, [trusteeId]: inbox }, lastActivity: Date.now() })),
  markLetterSeen: (trusteeId, seen = true) =>
    set((s) => {
      const cur = s.inboxes[trusteeId];
      return cur ? { inboxes: { ...s.inboxes, [trusteeId]: { ...cur, letterSeen: seen } } } : s;
    }),
  // Bỏ mọi tham chiếu tới nội dung đã giải mã để trình duyệt thu hồi bộ nhớ.
  lock: () => set({ inboxes: {} }),
  touch: () => set({ lastActivity: Date.now() }),
}));

/** Gắn bộ đếm tự khoá: gọi một lần khi app khởi động. */
export function installAutoLock() {
  const touch = () => useInboxSession.getState().touch();
  ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach((e) => window.addEventListener(e, touch, { passive: true }));
  const timer = window.setInterval(() => {
    const { inboxes, lastActivity, lock } = useInboxSession.getState();
    if (Object.keys(inboxes).length > 0 && Date.now() - lastActivity > AUTO_LOCK_MS) lock();
  }, 15_000);
  return () => window.clearInterval(timer);
}
