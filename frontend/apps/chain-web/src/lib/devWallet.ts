/**
 * Ví thử CHỈ cho localnet: khoá lưu trong sessionStorage của tab (tải lại trang không mất; mỗi tab một ví —
 * mở 2 tab để thử vai A và B). Tuyệt đối không dùng trên devnet/mainnet: trang đọc được khoá riêng.
 */
import { ed25519 } from '@noble/curves/ed25519';
import {
  BaseMessageSignerWalletAdapter, isVersionedTransaction, WalletNotConnectedError, WalletReadyState, type WalletName,
} from '@solana/wallet-adapter-base';
import { Keypair, type Transaction, type TransactionVersion, type VersionedTransaction } from '@solana/web3.js';

const STORAGE_KEY = 'lifenext:dev-wallet';
export const DevWalletName = 'Ví thử (localnet)' as WalletName<'Ví thử (localnet)'>;

function loadOrCreate(): Keypair {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(saved) as number[]));
  } catch { /* sessionStorage không dùng được → ví mới */ }
  const kp = Keypair.generate();
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(kp.secretKey))); } catch { /* bỏ qua */ }
  return kp;
}

export class DevWalletAdapter extends BaseMessageSignerWalletAdapter {
  name = DevWalletName;
  url = 'http://localhost';
  icon = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iOCIgZmlsbD0iIzk5NDVGRiIvPjwvc3ZnPg==';
  supportedTransactionVersions: ReadonlySet<TransactionVersion> = new Set(['legacy', 0] as TransactionVersion[]);
  private keypair: Keypair | null = null;

  get connecting() { return false; }
  get publicKey() { return this.keypair?.publicKey ?? null; }
  get readyState() { return WalletReadyState.Loadable; }

  async connect() {
    this.keypair = loadOrCreate();
    this.emit('connect', this.keypair.publicKey);
  }

  async disconnect() {
    this.keypair = null;
    this.emit('disconnect');
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (!this.keypair) throw new WalletNotConnectedError();
    if (isVersionedTransaction(tx)) tx.sign([this.keypair]);
    else tx.partialSign(this.keypair);
    return tx;
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this.keypair) throw new WalletNotConnectedError();
    return ed25519.sign(message, this.keypair.secretKey.slice(0, 32));
  }
}
