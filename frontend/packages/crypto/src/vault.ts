/**
 * Vòng đời khoá của OWNER: tạo két, mở khoá bằng passphrase, khôi phục bằng 12 từ,
 * mã hoá/giải mã từng hạng mục.
 *
 * Sơ đồ:
 *   passphrase ─Argon2id→ KEK₁ ─┐
 *   12 từ      ─BLAKE2b →  KEK₂ ─┴─bọc→ VaultKey ─bọc→ ItemKey (mỗi hạng mục) ─mã hoá→ nội dung
 */
import { fromBase64, toBase64, utf8, wipe } from './encoding';
import {
  Context,
  DEFAULT_KDF,
  SALT_BYTES,
  decrypt,
  decryptJson,
  deriveKeyFromEntropy,
  deriveKeyFromPassphrase,
  encrypt,
  encryptJson,
  generateKey,
  randomBytes,
  type KdfParams,
} from './primitives';
import { generateRecoveryPhrase, recoveryPhraseToEntropy } from './recovery';
import type { Allocation, VaultItemData } from './types';

const RECOVERY_LABEL = 'dn-recovery-v1';

/** Khớp InitializeVaultInput của API. */
export type VaultInitPayload = {
  kdfSalt: string;
  kdfOpsLimit: number;
  kdfMemLimit: number;
  passphraseWrappedKey: string;
  recoveryWrappedKey: string;
  recoverySalt: string;
};

/** Vật liệu khoá server trả về (khớp VaultDto). */
export type WrappedVault = {
  kdfSalt?: string | null;
  kdfOpsLimit?: number;
  kdfMemLimit?: number;
  passphraseWrappedKey?: string | null;
  recoveryWrappedKey?: string | null;
  recoverySalt?: string | null;
};

/**
 * Tạo két mới. Trả về payload gửi server (chỉ toàn dữ liệu đã bọc), VaultKey (giữ trong RAM)
 * và 12 từ khôi phục (hiển thị MỘT lần cho owner in ra giấy).
 */
export async function createVault(passphrase: string, kdf: KdfParams = DEFAULT_KDF) {
  const vaultKey = await generateKey();
  const kdfSalt = toBase64(await randomBytes(SALT_BYTES));
  const recoverySalt = toBase64(await randomBytes(SALT_BYTES));
  const recoveryPhrase = generateRecoveryPhrase();

  const kek1 = await deriveKeyFromPassphrase(passphrase, kdfSalt, kdf);
  const kek2 = await deriveKeyFromEntropy(recoveryPhraseToEntropy(recoveryPhrase), recoverySalt, RECOVERY_LABEL);

  const payload: VaultInitPayload = {
    kdfSalt,
    kdfOpsLimit: kdf.opsLimit,
    kdfMemLimit: kdf.memLimit,
    passphraseWrappedKey: await encrypt(vaultKey, kek1, Context.VaultKey),
    recoveryWrappedKey: await encrypt(vaultKey, kek2, Context.VaultKey),
    recoverySalt,
  };
  wipe(kek1);
  wipe(kek2);
  return { payload, vaultKey, recoveryPhrase };
}

/** Mở khoá két bằng passphrase. Sai passphrase → ném CryptoError (server không bao giờ biết passphrase). */
export async function unlockVault(v: WrappedVault, passphrase: string): Promise<Uint8Array> {
  const kek = await deriveKeyFromPassphrase(passphrase, v.kdfSalt!, { opsLimit: v.kdfOpsLimit!, memLimit: v.kdfMemLimit! });
  try {
    return await decrypt(v.passphraseWrappedKey!, kek, Context.VaultKey);
  } finally {
    wipe(kek);
  }
}

/** Khôi phục bằng 12 từ rồi đặt passphrase mới. Trả về VaultKey + payload ChangePassphraseInput. */
export async function recoverVault(v: WrappedVault, phrase: string, newPassphrase: string, kdf: KdfParams = DEFAULT_KDF) {
  const kek2 = await deriveKeyFromEntropy(recoveryPhraseToEntropy(phrase), v.recoverySalt!, RECOVERY_LABEL);
  const vaultKey = await decrypt(v.recoveryWrappedKey!, kek2, Context.VaultKey);
  wipe(kek2);
  return { vaultKey, changePassphrase: await rewrapWithPassphrase(vaultKey, newPassphrase, kdf) };
}

/** Bọc lại VaultKey bằng passphrase mới (đổi passphrase). */
export async function rewrapWithPassphrase(vaultKey: Uint8Array, newPassphrase: string, kdf: KdfParams = DEFAULT_KDF) {
  const kdfSalt = toBase64(await randomBytes(SALT_BYTES));
  const kek = await deriveKeyFromPassphrase(newPassphrase, kdfSalt, kdf);
  const passphraseWrappedKey = await encrypt(vaultKey, kek, Context.VaultKey);
  wipe(kek);
  return { kdfSalt, kdfOpsLimit: kdf.opsLimit, kdfMemLimit: kdf.memLimit, passphraseWrappedKey };
}

// ---------------------------------------------------------------------------
//  Hạng mục
// ---------------------------------------------------------------------------

/** Mã hoá một hạng mục: sinh ItemKey mới (hoặc dùng lại), mã hoá nội dung, bọc ItemKey bằng VaultKey. */
export async function encryptItem(vaultKey: Uint8Array, data: VaultItemData, existingItemKey?: Uint8Array) {
  const itemKey = existingItemKey ?? (await generateKey());
  return {
    ciphertext: await encryptJson(data, itemKey, Context.Item),
    wrappedItemKey: await encrypt(itemKey, vaultKey, Context.ItemKey),
    itemKey,
  };
}

export async function unwrapItemKey(vaultKey: Uint8Array, wrappedItemKey: string): Promise<Uint8Array> {
  return decrypt(wrappedItemKey, vaultKey, Context.ItemKey);
}

export async function decryptItem(vaultKey: Uint8Array, item: { ciphertext: string; wrappedItemKey: string }) {
  const itemKey = await unwrapItemKey(vaultKey, item.wrappedItemKey);
  const data = await decryptJson<VaultItemData>(item.ciphertext, itemKey, Context.Item);
  return { data, itemKey };
}

/** Giải mã hạng mục khi đã có ItemKey (phía trustee — ItemKey lấy từ grant). */
export async function decryptItemWithKey(ciphertext: string, itemKeyB64: string): Promise<VaultItemData> {
  return decryptJson<VaultItemData>(ciphertext, fromBase64(itemKeyB64), Context.Item);
}

// ---------------------------------------------------------------------------
//  Ma trận phân bổ (riêng owner)
// ---------------------------------------------------------------------------

export const encryptAllocation = (vaultKey: Uint8Array, a: Allocation) => encryptJson(a, vaultKey, Context.Allocation);

export async function decryptAllocation(vaultKey: Uint8Array, payload?: string | null): Promise<Allocation> {
  if (!payload) return { v: 1, assignments: {}, letters: {} };
  return decryptJson<Allocation>(payload, vaultKey, Context.Allocation);
}

export { utf8 };
