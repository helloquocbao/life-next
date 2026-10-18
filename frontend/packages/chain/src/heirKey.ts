/**
 * Ai giữ khoá két thay người nhận (B) cho tới lúc bàn giao. Gói két chứa bản "niêm phong" khoá cho B;
 * chỉ người giữ khoá mới mở được, và chỉ khi két đã được B `claim` trên chuỗi.
 */
import { fromBase64, toBase64 } from '@deathnote/crypto';

export type HeirKeyContext = {
  /** Địa chỉ PDA của két trên chuỗi. */
  vault: string;
  /** Ví của người nhận. */
  heir: string;
  programId: string;
};

export type SealedHeirKey =
  | { kind: 'lit'; network: string; ciphertext: string; dataToEncryptHash: string; conditions: unknown }
  | { kind: 'dev-local'; key: string };

export interface HeirKeyCustodian {
  seal(vaultKey: Uint8Array, ctx: HeirKeyContext): Promise<SealedHeirKey>;
  /** Người nhận (ví đang kết nối) xin lại khoá két. */
  open(sealed: SealedHeirKey, ctx: HeirKeyContext): Promise<Uint8Array>;
}

/**
 * CHỈ DÙNG TRÊN LOCALNET: không có ai giữ hộ — khoá nằm ngay trong gói (ai tải được gói là mở được).
 * Có để chạy trọn luồng A → B trên máy dev khi chưa có Lit; `assertSafeConfig` chặn dùng ngoài localnet.
 * Kiểm tra `claimed` ở đây chỉ là kiểm tra phía client.
 */
export class DevLocalCustodian implements HeirKeyCustodian {
  constructor(private isClaimed: (vault: string) => Promise<boolean>) {}

  async seal(vaultKey: Uint8Array): Promise<SealedHeirKey> {
    return { kind: 'dev-local', key: toBase64(vaultKey) };
  }

  async open(sealed: SealedHeirKey, ctx: HeirKeyContext): Promise<Uint8Array> {
    if (sealed.kind !== 'dev-local') throw new Error('Sai loại khoá niêm phong');
    if (!(await this.isClaimed(ctx.vault))) throw new Error('Két chưa được bàn giao.');
    return fromBase64(sealed.key);
  }
}
