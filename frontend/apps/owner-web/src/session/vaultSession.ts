/**
 * Phiên mở khoá két (VaultKey) — CHỈ nằm trong bộ nhớ, không bao giờ lưu xuống localStorage/sessionStorage.
 *
 * - Tải lại trang = phải nhập lại passphrase.
 * - Tự khoá sau 10 phút không thao tác (yêu cầu trong tài liệu: "phiên tự khoá sau 10 phút").
 * - Khi khoá: ghi đè 0 lên vùng nhớ chứa khoá.
 */
import { create } from 'zustand';
import { wipe } from '@deathnote/crypto';

export const AUTO_LOCK_MS = 10 * 60 * 1000;

type VaultSession = {
  vaultKey: Uint8Array | null;
  lastActivity: number;
  unlock: (key: Uint8Array) => void;
  lock: () => void;
  touch: () => void;
};

export const useVaultSession = create<VaultSession>((set, get) => ({
  vaultKey: null,
  lastActivity: Date.now(),
  unlock: (key) => set({ vaultKey: key, lastActivity: Date.now() }),
  lock: () => {
    wipe(get().vaultKey);
    set({ vaultKey: null });
  },
  touch: () => set({ lastActivity: Date.now() }),
}));

/** Gắn bộ đếm tự khoá: gọi một lần khi app khởi động. */
export function installAutoLock() {
  const touch = () => useVaultSession.getState().touch();
  ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach((e) => window.addEventListener(e, touch, { passive: true }));
  const timer = window.setInterval(() => {
    const { vaultKey, lastActivity, lock } = useVaultSession.getState();
    if (vaultKey && Date.now() - lastActivity > AUTO_LOCK_MS) lock();
  }, 15_000);
  return () => window.clearInterval(timer);
}
