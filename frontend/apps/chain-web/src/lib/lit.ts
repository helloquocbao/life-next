/**
 * Người giữ khoá cho người nhận qua Lit Protocol (devnet/mainnet). Cài đặt đầy đủ ở bước tích hợp Lit;
 * tạm thời báo rõ khi cấu hình chọn Lit mà chưa có.
 */
import type { PublicKey } from '@solana/web3.js';
import type { HeirKeyContext, HeirKeyCustodian, SealedHeirKey } from '@deathnote/chain';

export class LitCustodian implements HeirKeyCustodian {
  constructor(
    private network: string,
    private signMessage: ((m: Uint8Array) => Promise<Uint8Array>) | undefined,
    private me: PublicKey,
  ) {}

  async seal(_vaultKey: Uint8Array, _ctx: HeirKeyContext): Promise<SealedHeirKey> {
    void this.network; void this.signMessage; void this.me;
    throw new Error('Chưa bật Lit Protocol trong bản này.');
  }

  async open(_sealed: SealedHeirKey, _ctx: HeirKeyContext): Promise<Uint8Array> {
    throw new Error('Chưa bật Lit Protocol trong bản này.');
  }
}
