/**
 * Mật mã phía NGƯỜI ĐƯỢC UỶ QUYỀN (trustee):
 *   - Tạo cặp khoá cá nhân (khoá riêng bọc bằng passphrase của trustee).
 *   - Đồng thuận: mở mảnh khoá của mình, niêm phong lại cho từng trustee khác.
 *   - Hộp nhận: mở đủ m mảnh → ghép ReleaseKey → mở grant → giải mã hạng mục được phân.
 */
import { fromBase64, toBase64, utf8, wipe } from './encoding';
import {
  Context,
  DEFAULT_KDF,
  SALT_BYTES,
  decrypt,
  decryptJson,
  deriveKeyFromPassphrase,
  encrypt,
  generateBoxKeyPair,
  openSealed,
  randomBytes,
  seal,
  type BoxKeyPair,
  type KdfParams,
} from './primitives';
import { combineShares } from './shamir';
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
 * Đồng thuận = hành động mật mã: mở mảnh khoá của mình rồi niêm phong lại cho từng trustee nhận.
 * Server chỉ trao các bản niêm phong này cho người nhận SAU KHI hồ sơ được phát hành.
 */
export async function prepareConsentDeliveries(
  mySealedShare: string,
  keys: BoxKeyPair,
  recipients: { trusteeId: string; publicKey: string }[],
) {
  const share = await openSealed(mySealedShare, keys);
  try {
    return await Promise.all(
      recipients.map(async (r) => ({ toTrusteeId: r.trusteeId, sealedShare: await seal(share, r.publicKey) })),
    );
  } finally {
    wipe(share);
  }
}

/**
 * Mở hộp nhận: ghép ReleaseKey từ các mảnh, mở grant riêng của mình.
 * Trả về nội dung grant (thư mở đầu + danh sách hạng mục kèm ItemKey).
 */
export async function openInbox(args: {
  keys: BoxKeyPair;
  sealedShares: string[];
  threshold: number;
  sealedGrant?: string | null;
}): Promise<GrantPayload | null> {
  const shares = await Promise.all(args.sealedShares.map((s) => openSealed(s, args.keys)));
  const releaseKey = await combineShares(shares, args.threshold);
  shares.forEach(wipe);
  try {
    if (!args.sealedGrant) return null;
    const inner = utf8.decode(await openSealed(args.sealedGrant, args.keys));
    return await decryptJson<GrantPayload>(inner, releaseKey, Context.Grant);
  } finally {
    wipe(releaseKey);
  }
}
