/**
 * Người giữ khoá cho người nhận theo ngưỡng (k-trong-n), thay cho Lit Protocol.
 *
 * - Khoá két được chia Shamir thành n mảnh, cần k mảnh để ghép lại. Mỗi mảnh niêm phong (sealed box) bằng khoá công
 *   khai của một "nút mở khoá" độc lập. Một nút chỉ giữ MỘT khoá riêng, không lưu dữ liệu.
 * - Khi bàn giao, B ký MỘT thông điệp; mỗi nút tự đọc chuỗi: két phải `claimed` và người nhận đúng là ví đã ký,
 *   rồi mới mở mảnh của mình và niêm phong lại cho khoá tạm của B. B ghép đủ k mảnh → khoá két.
 * - Ít hơn k nút thông đồng thì không mở được gì; nút bị hack cũng không có gì để lộ.
 */
import { combine, split } from 'shamir-secret-sharing';
import { fromBase64, getSodium, toBase64, utf8 } from '@deathnote/crypto';
import type { HeirKeyContext, HeirKeyCustodian, SealedHeirKey } from './heirKey';

export type ReleaseNode = { url: string; publicKey: string };
export type ThresholdSealed = Extract<SealedHeirKey, { kind: 'threshold' }>;

/** Nội dung bên trong mỗi mảnh niêm phong — gắn với đúng két + người nhận, nút sẽ đối chiếu. */
type SharePayload = { v: 1; vault: string; heir: string; share: string };

/** Thông điệp B ký để xin mảnh khoá (một chữ ký dùng cho mọi nút). */
export const releaseMessage = (vault: string, replyPublicKey: string, ts: number) =>
  `LifeNext — nhận két\nKét: ${vault}\nKhoá nhận: ${replyPublicKey}\nThời điểm: ${ts}`;

export type ReleaseRequest = {
  vault: string;
  heir: string;
  sealedShare: string;
  replyPublicKey: string;
  timestamp: number;
  signature: string;
};

export class ThresholdCustodian implements HeirKeyCustodian {
  constructor(
    private nodes: ReleaseNode[],
    private threshold: number,
    /** Ví người nhận ký thông điệp xin mảnh (chỉ cần khi mở). */
    private signMessage?: (m: Uint8Array) => Promise<Uint8Array>,
    private fetchImpl: typeof fetch = (...a) => fetch(...a),
  ) {
    if (threshold < 2 || threshold > nodes.length) throw new Error('Ngưỡng phải từ 2 tới số nút.');
  }

  async seal(vaultKey: Uint8Array, ctx: HeirKeyContext): Promise<SealedHeirKey> {
    const s = await getSodium();
    const shares = await split(vaultKey, this.nodes.length, this.threshold);
    return {
      kind: 'threshold',
      threshold: this.threshold,
      shares: this.nodes.map((n, i) => {
        const payload: SharePayload = { v: 1, vault: ctx.vault, heir: ctx.heir, share: toBase64(shares[i]) };
        const sealed = s.crypto_box_seal(utf8.encode(JSON.stringify(payload)), fromBase64(n.publicKey));
        return { url: n.url, publicKey: n.publicKey, sealed: toBase64(sealed) };
      }),
    };
  }

  async open(sealed: SealedHeirKey, ctx: HeirKeyContext): Promise<Uint8Array> {
    if (sealed.kind !== 'threshold') throw new Error('Sai loại khoá niêm phong');
    if (!this.signMessage) throw new Error('Ví không hỗ trợ ký thông điệp.');
    const s = await getSodium();
    const reply = s.crypto_box_keypair();
    const replyPublicKey = toBase64(reply.publicKey);
    const ts = Math.floor(Date.now() / 1000);
    const signature = toBase64(await this.signMessage(utf8.encode(releaseMessage(ctx.vault, replyPublicKey, ts))));

    const results = await Promise.allSettled(
      sealed.shares.map(async (sh) => {
        const body: ReleaseRequest = { vault: ctx.vault, heir: ctx.heir, sealedShare: sh.sealed, replyPublicKey, timestamp: ts, signature };
        const res = await this.fetchImpl(`${sh.url}/release`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? `Nút ${sh.url} từ chối (${res.status})`);
        }
        const { sealedShare } = (await res.json()) as { sealedShare: string };
        return s.crypto_box_seal_open(fromBase64(sealedShare), reply.publicKey, reply.privateKey);
      }),
    );
    const got = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    if (got.length < sealed.threshold) {
      const reasons = results.flatMap((r) => (r.status === 'rejected' ? [String((r.reason as Error).message)] : []));
      throw new Error(`Chưa đủ nút mở khoá (${got.length}/${sealed.threshold}): ${[...new Set(reasons)].join('; ')}`);
    }
    return combine(got.slice(0, sealed.threshold));
  }
}
