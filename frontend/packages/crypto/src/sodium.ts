/**
 * Khởi tạo libsodium (bản WebAssembly, "sumo" để có Argon2id).
 *
 * libsodium là thư viện mật mã được kiểm toán rộng rãi, dùng trong Signal, WireGuard, 1Password…
 * Sau này app iOS dùng `swift-sodium` — cùng thuật toán, cùng định dạng dữ liệu,
 * nên ciphertext tạo trên web mở được trên iOS và ngược lại.
 */
import _sodium from 'libsodium-wrappers-sumo';

export type Sodium = typeof _sodium;

let readyPromise: Promise<Sodium> | null = null;

/** Luôn `await getSodium()` trước khi dùng bất kỳ hàm mật mã nào. */
export function getSodium(): Promise<Sodium> {
  if (!readyPromise) {
    readyPromise = _sodium.ready.then(() => _sodium);
  }
  return readyPromise;
}
