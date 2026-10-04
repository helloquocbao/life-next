/**
 * Các khối mật mã nguyên thuỷ. Mọi thứ phía trên (vault, trustee, chia khoá) chỉ ghép từ các hàm này.
 *
 * | Mục đích                     | Thuật toán                                   |
 * |------------------------------|----------------------------------------------|
 * | Mã hoá đối xứng có xác thực  | XChaCha20-Poly1305 (IETF AEAD, nonce 192-bit)|
 * | Dẫn xuất khoá từ passphrase  | Argon2id (chống brute-force bằng GPU/ASIC)   |
 * | Mã hoá cho người nhận        | X25519 + XSalsa20-Poly1305 (crypto_box_seal) |
 * | Băm                          | BLAKE2b                                      |
 */
import { getSodium } from './sodium';
import { fromBase64, toBase64, utf8 } from './encoding';

export const KEY_BYTES = 32;
export const SALT_BYTES = 16;

/**
 * Tham số Argon2id mặc định: 3 vòng, 64 MiB RAM (~0,5–1 giây trên laptop/điện thoại tầm trung).
 * Đủ chậm để brute-force passphrase trở nên cực tốn kém, đủ nhanh để người dùng không khó chịu.
 */
export const DEFAULT_KDF = { opsLimit: 3, memLimit: 64 * 1024 * 1024 } as const;
export type KdfParams = { opsLimit: number; memLimit: number };

/**
 * "Associated data" gắn ngữ cảnh vào mỗi ciphertext. Ciphertext tạo cho ngữ cảnh này sẽ không
 * giải mã được ở ngữ cảnh khác — chặn kiểu tấn công tráo đổi dữ liệu giữa các trường.
 */
export const Context = {
  VaultKey: 'dn:v1:vault-key',
  ItemKey: 'dn:v1:item-key',
  Item: 'dn:v1:item',
  Allocation: 'dn:v1:allocation',
  Keyring: 'dn:v1:keyring',
} as const;
export type ContextName = (typeof Context)[keyof typeof Context];

export async function randomBytes(length: number): Promise<Uint8Array> {
  const s = await getSodium();
  return s.randombytes_buf(length);
}

export const generateKey = () => randomBytes(KEY_BYTES);

/** Argon2id: passphrase + salt → khoá 32 byte. */
export async function deriveKeyFromPassphrase(passphrase: string, saltB64: string, params: KdfParams): Promise<Uint8Array> {
  const s = await getSodium();
  return s.crypto_pwhash(
    KEY_BYTES,
    passphrase.normalize('NFKC'),
    fromBase64(saltB64),
    params.opsLimit,
    params.memLimit,
    s.crypto_pwhash_ALG_ARGON2ID13,
  );
}

/** BLAKE2b — dẫn xuất khoá nhanh từ dữ liệu đã có độ ngẫu nhiên cao (vd. entropy 128-bit của 12 từ khôi phục). */
export async function deriveKeyFromEntropy(entropy: Uint8Array, saltB64: string, label: string): Promise<Uint8Array> {
  const s = await getSodium();
  const input = new Uint8Array([...utf8.encode(label), ...entropy, ...fromBase64(saltB64)]);
  return s.crypto_generichash(KEY_BYTES, input, null);
}

/**
 * Mã hoá có xác thực. Đầu ra base64 của (nonce 24 byte ‖ ciphertext ‖ tag 16 byte).
 * Bất kỳ thay đổi nào trên ciphertext đều làm giải mã thất bại (không thể sửa lén).
 */
export async function encrypt(plaintext: Uint8Array, key: Uint8Array, context: ContextName): Promise<string> {
  const s = await getSodium();
  const nonce = s.randombytes_buf(s.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const ct = s.crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, utf8.encode(context), null, nonce, key);
  const out = new Uint8Array(nonce.length + ct.length);
  out.set(nonce, 0);
  out.set(ct, nonce.length);
  return toBase64(out);
}

export async function decrypt(payloadB64: string, key: Uint8Array, context: ContextName): Promise<Uint8Array> {
  const s = await getSodium();
  const data = fromBase64(payloadB64);
  const n = s.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
  try {
    return s.crypto_aead_xchacha20poly1305_ietf_decrypt(null, data.subarray(n), utf8.encode(context), data.subarray(0, n), key);
  } catch {
    throw new CryptoError('Không giải mã được: sai khoá hoặc dữ liệu đã bị thay đổi.');
  }
}

export const encryptJson = (value: unknown, key: Uint8Array, context: ContextName) =>
  encrypt(utf8.encode(JSON.stringify(value)), key, context);

export async function decryptJson<T>(payloadB64: string, key: Uint8Array, context: ContextName): Promise<T> {
  return JSON.parse(utf8.decode(await decrypt(payloadB64, key, context))) as T;
}

// ---------------------------------------------------------------------------
//  Mã hoá khoá công khai (người nhận)
// ---------------------------------------------------------------------------

export type BoxKeyPair = { publicKey: Uint8Array; privateKey: Uint8Array };

export async function generateBoxKeyPair(): Promise<BoxKeyPair> {
  const s = await getSodium();
  const kp = s.crypto_box_keypair();
  return { publicKey: kp.publicKey, privateKey: kp.privateKey };
}

/**
 * Niêm phong (sealed box): chỉ người giữ khoá riêng tương ứng với `publicKeyB64` mở được.
 * Người gửi không cần danh tính riêng — đúng mô hình owner niêm phong phần dành cho từng người nhận.
 */
export async function seal(message: Uint8Array, publicKeyB64: string): Promise<string> {
  const s = await getSodium();
  return toBase64(s.crypto_box_seal(message, fromBase64(publicKeyB64)));
}

export async function openSealed(sealedB64: string, keys: BoxKeyPair): Promise<Uint8Array> {
  const s = await getSodium();
  try {
    return s.crypto_box_seal_open(fromBase64(sealedB64), keys.publicKey, keys.privateKey);
  } catch {
    throw new CryptoError('Không mở được dữ liệu niêm phong: dữ liệu không dành cho bạn hoặc đã bị thay đổi.');
  }
}

export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoError';
  }
}
