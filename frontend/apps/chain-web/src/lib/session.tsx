/**
 * Phiên làm việc: kết nối RPC, client chương trình, nơi lưu gói két, người giữ khoá cho người nhận,
 * và KHOÁ CHỦ của A (lấy từ chữ ký ví — chỉ giữ trong bộ nhớ tab, tải lại trang là phải ký lại).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAnchorWallet, useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import {
  createLifenext, deriveMasterKey, DevLocalCustodian, KuboStore, masterKeyMessage, ThresholdCustodian,
  type BlobStore, type HeirKeyCustodian, type Lifenext_Client,
} from '@deathnote/chain';
import { config } from '../config';

type Session = {
  client: Lifenext_Client;
  me: PublicKey;
  store: BlobStore;
  custodian: HeirKeyCustodian;
  masterKey: Uint8Array | null;
  unlock: () => Promise<Uint8Array>;
};

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();
  const { signMessage } = useWallet();
  const [masterKey, setMasterKey] = useState<Uint8Array | null>(null);

  // Đổi ví → bỏ khoá chủ của ví cũ.
  const me = anchorWallet?.publicKey?.toBase58();
  useEffect(() => setMasterKey(null), [me]);

  const base = useMemo(() => {
    if (!anchorWallet) return null;
    const client = createLifenext(connection, { ...anchorWallet, payer: undefined } as never, config);
    const isClaimed = async (vault: string) => (await client.fetchVault(new PublicKey(vault)))?.claimed ?? false;
    const custodian: HeirKeyCustodian =
      config.heirKey.kind === 'threshold'
        ? new ThresholdCustodian(config.heirKey.nodes, config.heirKey.threshold, signMessage)
        : new DevLocalCustodian(isClaimed);
    return {
      client,
      me: anchorWallet.publicKey,
      store: new KuboStore(config.storage.apiUrl, config.storage.gatewayUrl),
      custodian,
    };
  }, [anchorWallet, connection, signMessage]);

  const unlock = useCallback(async () => {
    if (masterKey) return masterKey;
    if (!anchorWallet || !signMessage) throw new Error('Ví này không hỗ trợ ký thông điệp.');
    const msg = new TextEncoder().encode(masterKeyMessage(window.location.origin, anchorWallet.publicKey.toBase58()));
    const key = await deriveMasterKey(await signMessage(msg));
    setMasterKey(key);
    return key;
  }, [anchorWallet, masterKey, signMessage]);

  const value = useMemo(() => (base ? { ...base, masterKey, unlock } : null), [base, masterKey, unlock]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Chỉ dùng bên trong phần đã kết nối ví. */
export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error('Chưa kết nối ví');
  return s;
}

export const useOptionalSession = () => useContext(Ctx);
