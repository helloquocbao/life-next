/**
 * Kiểm thử trọn luồng trên validator local + IPFS dev (chain/scripts/localnet.sh, chain/docker-compose.yml).
 * Chạy: LOCALNET=1 pnpm --filter @deathnote/chain test   (~2,5 phút vì phải đợi tới hạn bàn giao ở bản demo-time)
 */
import { describe, expect, it } from 'vitest';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, type Transaction, type VersionedTransaction } from '@solana/web3.js';
import type { Wallet } from '@anchor-lang/core';
import type { ChainConfig } from './config';
import { DevLocalCustodian } from './heirKey';
import { createLifenext } from './program';
import { ownerStatus } from './status';
import { KuboStore } from './storage';
import { deriveMasterKey, openAsHeir, openAsOwner, parsePackage, sealVault, verifyHash, type VaultContent } from './vaultCrypto';

const RUN = process.env.LOCALNET === '1';

const cfg: ChainConfig = {
  cluster: 'localnet',
  rpcUrl: 'http://127.0.0.1:8899',
  programId: 'CWUPdsmDTAGh22Q7MGNHg5YhUzk5WNkcxQ7FN2etfQNS',
  treasury: '4hHj5bsNyVrXwJfwDPjdyoD2dJVxLHWNVTV7ULe8kCTa',
  demoTime: true,
  monthlyPriceLamports: 20_000_000,
  storage: { kind: 'kubo', apiUrl: 'http://127.0.0.1:5011', gatewayUrl: 'http://127.0.0.1:8088' },
  heirKey: { kind: 'dev-local' },
};

const walletOf = (kp: Keypair): Wallet => ({
  publicKey: kp.publicKey,
  payer: kp,
  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T) {
    if ('version' in tx) tx.sign([kp]);
    else tx.partialSign(kp);
    return tx;
  },
  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]) {
    for (const tx of txs) await this.signTransaction(tx);
    return txs;
  },
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function funded(connection: Connection) {
  const kp = Keypair.generate();
  const sig = await connection.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, 'confirmed');
  return kp;
}

describe.skipIf(!RUN)('LifeNext trên localnet', () => {
  const connection = new Connection(cfg.rpcUrl, 'confirmed');
  const store = new KuboStore(cfg.storage.apiUrl, cfg.storage.gatewayUrl);

  it('thanh toán = check-in, giới hạn trả trước 90 ngày', async () => {
    const a = await funded(connection);
    const ln = createLifenext(connection, walletOf(a), cfg);
    const treasuryBefore = await connection.getBalance(new PublicKey(cfg.treasury));
    await ln.pay(1);
    const p1 = await ln.fetchProfile();
    expect(p1!.paidUntil - p1!.createdAt).toBe(120);
    await ln.pay(2);
    await expect(ln.pay(1)).rejects.toThrow(/PrepayLimitExceeded/);
    expect((await connection.getBalance(new PublicKey(cfg.treasury))) - treasuryBefore).toBe(3 * cfg.monthlyPriceLamports);
  });

  it('A tạo két → B nhận sau khi A quá hạn → B mở được nội dung', async () => {
    const a = await funded(connection);
    const b = await funded(connection);
    const lnA = createLifenext(connection, walletOf(a), cfg);
    const lnB = createLifenext(connection, walletOf(b), cfg);
    const isClaimed = async (vault: string) => (await lnB.fetchVault(new PublicKey(vault)))?.claimed ?? false;
    const custodian = new DevLocalCustodian(isClaimed);

    // A: khoá chủ từ chữ ký ví (ở đây ký giả lập bằng nacl qua Keypair) → mã hoá → IPFS → ghi lên chuỗi.
    const master = await deriveMasterKey(a.secretKey.slice(0, 32));
    const content: VaultContent = {
      v: 1,
      title: 'Cho B',
      entries: [{ label: 'Ngân hàng', value: 'VCB 0123456789' }],
      files: [{ name: 'note.txt', type: 'text/plain', size: 5, dataB64: btoa('hello') }],
      updatedAt: new Date().toISOString(),
    };
    const vaultAddr = await lnA.nextVaultAddress();
    const sealed = await sealVault({
      content,
      masterKey: master,
      ctx: { vault: vaultAddr.toBase58(), heir: b.publicKey.toBase58(), owner: a.publicKey.toBase58(), programId: cfg.programId },
      custodian,
    });
    const uri = await store.put(sealed.bytes);
    const { vault } = await lnA.createVault(b.publicKey, uri, sealed.hash);
    expect(vault.toBase58()).toBe(vaultAddr.toBase58());

    // A tự mở lại được.
    const onChain = (await lnA.fetchVault(vault))!;
    const bytes = await store.get(onChain.uri);
    await verifyHash(bytes, onChain.contentHash);
    expect((await openAsOwner(parsePackage(bytes), master)).content).toEqual(content);

    // B thấy két trong hộp nhận nhưng chưa nhận / chưa mở được.
    expect((await lnB.listHeirVaults()).map((v) => v.address.toBase58())).toContain(vault.toBase58());
    await expect(lnB.claim(onChain)).rejects.toThrow(/NotReleasedYet/);
    await expect(openAsHeir(parsePackage(bytes), custodian)).rejects.toThrow('chưa được bàn giao');

    // Tạo két lần đầu đã trả tháng đầu → đợi hết tháng đó + 30 ngày quá hạn (demo: 240 giây).
    const profile = (await lnA.fetchProfile())!;
    for (;;) {
      const st = ownerStatus(cfg, profile.paidUntil, await lnB.chainNow());
      if (st.phase === 'released') break;
      await sleep(5000);
    }
    const treasuryBefore = await connection.getBalance(new PublicKey(cfg.treasury));
    await lnB.claim(onChain);
    expect((await connection.getBalance(new PublicKey(cfg.treasury))) - treasuryBefore).toBe(cfg.monthlyPriceLamports);
    expect(await openAsHeir(parsePackage(await store.get(onChain.uri)), custodian)).toEqual(content);
  }, 360_000);
});
