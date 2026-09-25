/**
 * Chuyển KeyringDto (server) → KeyringPayload (crypto) để mở khoá bằng passphrase.
 *
 * Server chỉ giữ khoá riêng ĐÃ BỌC bằng khoá dẫn xuất từ passphrase (Argon2id) — PICO không thể mở.
 */
import type { KeyringDto } from '@deathnote/api';
import { unlockKeyring, type BoxKeyPair, type KeyringPayload } from '@deathnote/crypto';

export function toKeyringPayload(k: KeyringDto | undefined): KeyringPayload | null {
  if (!k?.exists || !k.publicKey || !k.encryptedPrivateKey || !k.kdfSalt) return null;
  return {
    publicKey: k.publicKey,
    encryptedPrivateKey: k.encryptedPrivateKey,
    kdfSalt: k.kdfSalt,
    kdfOpsLimit: k.kdfOpsLimit ?? 0,
    kdfMemLimit: k.kdfMemLimit ?? 0,
  };
}

/**
 * Mở khoá cá nhân bằng passphrase. Sai passphrase ⇒ giải mã AEAD thất bại ⇒ báo lỗi thân thiện
 * (không phân biệt "sai passphrase" với "dữ liệu hỏng" để tránh lộ thông tin).
 */
export async function unlockWithPassphrase(k: KeyringDto | undefined, passphrase: string): Promise<BoxKeyPair> {
  const payload = toKeyringPayload(k);
  if (!payload) throw new Error('Bạn chưa tạo khoá cá nhân. Hãy tạo khoá trước.');
  try {
    return await unlockKeyring(payload, passphrase);
  } catch {
    throw new Error('Passphrase không đúng. Hãy kiểm tra lại (phân biệt chữ hoa/thường, dấu tiếng Việt).');
  }
}
