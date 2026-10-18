/**
 * Mã hoá két — chạy 100% trên trình duyệt.
 *
 * - Khoá chủ của A lấy từ CHỮ KÝ VÍ trên một thông điệp cố định (Ed25519 ký tất định → cùng ví luôn ra cùng khoá).
 *   Không lưu ở đâu: mất ví = mất két.
 * - Mỗi két có khoá ngẫu nhiên riêng, niêm phong 2 bản: cho A (bằng khoá chủ) và cho B (qua người giữ khoá).
 * - Nội dung (chữ + tệp) mã hoá XChaCha20-Poly1305 bằng khoá két.
 */
import { Context, decrypt, decryptJson, encrypt, encryptJson, fromBase64, generateKey, getSodium, utf8 } from '@deathnote/crypto';
import type { HeirKeyContext, HeirKeyCustodian, SealedHeirKey } from './heirKey';

export type VaultEntry = { label: string; value: string; secret?: boolean };
export type VaultFile = { name: string; type: string; size: number; dataB64: string };
export type VaultContent = { v: 1; title: string; note?: string; entries: VaultEntry[]; files: VaultFile[]; updatedAt: string };

/** Gói lưu ngoài chuỗi (JSON). Không có gì ở dạng rõ ngoài các địa chỉ công khai vốn đã có trên chuỗi. */
export type VaultPackage = {
  v: 1;
  programId: string;
  vault: string;
  owner: string;
  heir: string;
  ownerKey: string;
  heirKey: SealedHeirKey;
  payload: string;
};

/** Tổng dung lượng tệp mỗi két (trước mã hoá) cho MVP. */
export const MAX_VAULT_FILES_BYTES = 5 * 1024 * 1024;

/**
 * Thông điệp A ký để mở két. Ghi rõ tên miền + ví để ví hiển thị cho người dùng thấy: trang khác xin ký đúng câu này
 * là lừa đảo (ai có chữ ký này sẽ có khoá két).
 */
export const masterKeyMessage = (origin: string, owner: string) =>
  `LifeNext — mở két của bạn\n\nChỉ ký trên trang: ${origin}\nVí: ${owner}\n\n` +
  `Chữ ký này tạo ra khoá mở két. Đừng bao giờ ký thông điệp này ở trang khác.`;

export async function deriveMasterKey(signature: Uint8Array): Promise<Uint8Array> {
  const s = await getSodium();
  return s.crypto_generichash(32, new Uint8Array([...utf8.encode(Context.ChainMasterKey), ...signature]), null);
}

export async function sealVault(args: {
  content: VaultContent;
  masterKey: Uint8Array;
  ctx: HeirKeyContext & { owner: string };
  custodian: HeirKeyCustodian;
  /** Giữ khoá két cũ khi chỉ sửa nội dung (không đổi người nhận). */
  vaultKey?: Uint8Array;
}): Promise<{ bytes: Uint8Array; hash: Uint8Array; vaultKey: Uint8Array }> {
  const fileBytes = args.content.files.reduce((n, f) => n + f.size, 0);
  if (fileBytes > MAX_VAULT_FILES_BYTES) throw new Error('Tệp đính kèm vượt quá 5 MB mỗi két.');
  const vaultKey = args.vaultKey ?? (await generateKey());
  const pkg: VaultPackage = {
    v: 1,
    programId: args.ctx.programId,
    vault: args.ctx.vault,
    owner: args.ctx.owner,
    heir: args.ctx.heir,
    ownerKey: await encrypt(vaultKey, args.masterKey, Context.ChainVaultKey),
    heirKey: await args.custodian.seal(vaultKey, args.ctx),
    payload: await encryptJson(args.content, vaultKey, Context.ChainVault),
  };
  const bytes = utf8.encode(JSON.stringify(pkg));
  return { bytes, hash: await sha256(bytes), vaultKey };
}

export function parsePackage(bytes: Uint8Array): VaultPackage {
  const pkg = JSON.parse(utf8.decode(bytes)) as VaultPackage;
  if (pkg.v !== 1) throw new Error('Phiên bản gói két không hỗ trợ');
  return pkg;
}

/** A mở két của mình bằng khoá chủ. */
export async function openAsOwner(pkg: VaultPackage, masterKey: Uint8Array) {
  const vaultKey = await decrypt(pkg.ownerKey, masterKey, Context.ChainVaultKey);
  return { vaultKey, content: await decryptJson<VaultContent>(pkg.payload, vaultKey, Context.ChainVault) };
}

/** B mở két sau khi đã nhận bàn giao: xin khoá từ người giữ khoá. */
export async function openAsHeir(pkg: VaultPackage, custodian: HeirKeyCustodian) {
  const vaultKey = await custodian.open(pkg.heirKey, { vault: pkg.vault, heir: pkg.heir, programId: pkg.programId });
  return decryptJson<VaultContent>(pkg.payload, vaultKey, Context.ChainVault);
}

/** Kiểm tra gói tải về đúng là gói đã ghi trên chuỗi (không bị tráo ở nơi lưu trữ). */
export async function verifyHash(bytes: Uint8Array, expected: Uint8Array | number[]) {
  const h = await sha256(bytes);
  const e = Uint8Array.from(expected);
  if (h.length !== e.length || h.some((b, i) => b !== e[i])) throw new Error('Gói két không khớp với dữ liệu trên chuỗi.');
}

export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
}

export { fromBase64 };
