/**
 * Luật của một nút mở khoá — thuần, không I/O để kiểm thử được.
 *
 * Nút chỉ trả mảnh khoá khi TẤT CẢ đúng:
 * 1. Chữ ký ed25519 hợp lệ của ví người nhận trên thông điệp xin mảnh, còn mới (±5 phút).
 * 2. Tài khoản két trên chuỗi thuộc đúng chương trình LifeNext, đúng loại Vault, đã `claimed`,
 *    và người nhận ghi trên chuỗi chính là ví đã ký.
 * 3. Mảnh niêm phong mở được bằng khoá của nút và gắn đúng két + người nhận đó.
 * Mảnh trả về được niêm phong cho khoá tạm của người xin — đường truyền có bị nghe lén cũng vô ích.
 */
import { createHash } from 'node:crypto';
import { ed25519 } from '@noble/curves/ed25519';
import { PublicKey } from '@solana/web3.js';
import sodium from 'libsodium-wrappers-sumo';

export const MAX_SKEW_SECONDS = 300;

export type ReleaseRequest = {
  vault: string;
  heir: string;
  sealedShare: string;
  replyPublicKey: string;
  timestamp: number;
  signature: string;
};

export type VaultOnChain = { owner: string; data: Uint8Array } | null;

export type NodeKeys = { publicKey: Uint8Array; secretKey: Uint8Array };

export class ReleaseError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Phải khớp `releaseMessage` ở @deathnote/chain (threshold.ts). */
export const releaseMessage = (vault: string, replyPublicKey: string, ts: number) =>
  `LifeNext — nhận két\nKét: ${vault}\nKhoá nhận: ${replyPublicKey}\nThời điểm: ${ts}`;

const VAULT_DISCRIMINATOR = createHash('sha256').update('account:Vault').digest().subarray(0, 8);
const b64 = (s: string) => new Uint8Array(Buffer.from(s, 'base64'));

export async function handleRelease(
  req: ReleaseRequest,
  deps: { programId: string; keys: NodeKeys; now: number; getVault: (address: string) => Promise<VaultOnChain> },
): Promise<string> {
  await sodium.ready;
  for (const f of ['vault', 'heir', 'sealedShare', 'replyPublicKey', 'signature'] as const)
    if (typeof req[f] !== 'string' || !req[f]) throw new ReleaseError(400, `Thiếu ${f}`);
  if (!Number.isInteger(req.timestamp) || Math.abs(deps.now - req.timestamp) > MAX_SKEW_SECONDS)
    throw new ReleaseError(400, 'Yêu cầu đã hết hạn — ký lại.');

  let heir: PublicKey;
  try {
    heir = new PublicKey(req.heir);
    new PublicKey(req.vault);
  } catch {
    throw new ReleaseError(400, 'Địa chỉ không hợp lệ');
  }

  const msg = new TextEncoder().encode(releaseMessage(req.vault, req.replyPublicKey, req.timestamp));
  let sigOk = false;
  try { sigOk = ed25519.verify(b64(req.signature), msg, heir.toBytes()); } catch { sigOk = false; }
  if (!sigOk) throw new ReleaseError(401, 'Chữ ký không hợp lệ');

  const acc = await deps.getVault(req.vault);
  if (!acc || acc.owner !== deps.programId) throw new ReleaseError(404, 'Không tìm thấy két');
  const d = acc.data;
  if (d.length < 73 || !Buffer.from(d.subarray(0, 8)).equals(VAULT_DISCRIMINATOR)) throw new ReleaseError(404, 'Không phải tài khoản két');
  const onChainHeir = new PublicKey(d.subarray(40, 72));
  if (!onChainHeir.equals(heir)) throw new ReleaseError(403, 'Ví này không phải người nhận của két');
  if (d[72] !== 1) throw new ReleaseError(403, 'Két chưa được bàn giao');

  let payload: { v: number; vault: string; heir: string; share: string };
  try {
    const opened = sodium.crypto_box_seal_open(b64(req.sealedShare), deps.keys.publicKey, deps.keys.secretKey);
    payload = JSON.parse(new TextDecoder().decode(opened));
  } catch {
    throw new ReleaseError(400, 'Mảnh khoá không thuộc nút này');
  }
  if (payload.vault !== req.vault || payload.heir !== req.heir) throw new ReleaseError(403, 'Mảnh khoá không thuộc két này');

  const resealed = sodium.crypto_box_seal(b64(payload.share), b64(req.replyPublicKey));
  return Buffer.from(resealed).toString('base64');
}
