/**
 * Mật mã phía NGƯỜI ĐƯỢC UỶ QUYỀN (trustee):
 *   - Tạo cặp khoá cá nhân (khoá riêng bọc bằng passphrase của trustee).
 *   - Hộp nhận: mở phần được niêm phong riêng cho mình (grant) → giải mã hạng mục được phân.
 */
import { fromBase64, toBase64, utf8, wipe } from './encoding';
import {
  Context,
  DEFAULT_KDF,
  SALT_BYTES,
  decrypt,
  deriveKeyFromPassphrase,
  encrypt,
  generateBoxKeyPair,
  openSealed,
  randomBytes,
  type BoxKeyPair,
  type KdfParams,
} from './primitives';
import type { GrantPayload } from './types';

/** Khớp CreateKeyringInput của API. */
export type KeyringPayload = {
  publicKey: string;
  encryptedPrivateKey: string;
  kdfSalt: string;
  kdfOpsLimit: number;
  kdfMemLimit: number;
};

export async function createKeyring(passphrase: string, kdf: KdfParams = DEFAULT_KDF) {
  const keys = await generateBoxKeyPair();
  const kdfSalt = toBase64(await randomBytes(SALT_BYTES));
  const kek = await deriveKeyFromPassphrase(passphrase, kdfSalt, kdf);
  const payload: KeyringPayload = {
    publicKey: toBase64(keys.publicKey),
    encryptedPrivateKey: await encrypt(keys.privateKey, kek, Context.Keyring),
    kdfSalt,
    kdfOpsLimit: kdf.opsLimit,
    kdfMemLimit: kdf.memLimit,
  };
  wipe(kek);
  return { payload, keys };
}

export async function unlockKeyring(k: KeyringPayload, passphrase: string): Promise<BoxKeyPair> {
  const kek = await deriveKeyFromPassphrase(passphrase, k.kdfSalt, { opsLimit: k.kdfOpsLimit, memLimit: k.kdfMemLimit });
  try {
    const privateKey = await decrypt(k.encryptedPrivateKey, kek, Context.Keyring);
    return { publicKey: fromBase64(k.publicKey), privateKey };
  } finally {
    wipe(kek);
  }
}

/**
 * Mở hộp nhận: mở phần dành riêng cho mình (đã niêm phong bằng khoá công khai của mình) bằng khoá riêng.
 * Trả về nội dung grant (thư mở đầu + danh sách hạng mục kèm ItemKey), hoặc null nếu owner không phân gì.
 */
export async function openGrant(args: { keys: BoxKeyPair; sealedGrant?: string | null }): Promise<GrantPayload | null> {
  if (!args.sealedGrant) return null;
  const plain = await openSealed(args.sealedGrant, args.keys);
  try {
    return JSON.parse(utf8.decode(plain)) as GrantPayload;
  } finally {
    wipe(plain);
  }
}
