import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ed25519 } from '@noble/curves/ed25519';
import { Keypair, PublicKey } from '@solana/web3.js';
import sodium from 'libsodium-wrappers-sumo';
import { ThresholdCustodian } from '@deathnote/chain';
import { handleRelease, ReleaseError, type NodeKeys, type VaultOnChain } from './release.ts';

const PROGRAM = 'CWUPdsmDTAGh22Q7MGNHg5YhUzk5WNkcxQ7FN2etfQNS';
const disc = createHash('sha256').update('account:Vault').digest().subarray(0, 8);

function vaultData(owner: PublicKey, heir: PublicKey, claimed: boolean) {
  const d = new Uint8Array(200);
  d.set(disc, 0);
  d.set(owner.toBytes(), 8);
  d.set(heir.toBytes(), 40);
  d[72] = claimed ? 1 : 0;
  return d;
}

async function makeNodes(n: number): Promise<NodeKeys[]> {
  await sodium.ready;
  return Array.from({ length: n }, () => {
    const kp = sodium.crypto_box_keypair();
    return { publicKey: kp.publicKey, secretKey: kp.privateKey };
  });
}

/** Mạng giả: fetch tới http://node-i/release gọi thẳng handleRelease của nút i. */
function fakeNetwork(nodes: NodeKeys[], chain: Map<string, VaultOnChain>, down = new Set<number>()) {
  return (async (url: string, init?: RequestInit) => {
    const i = Number(new URL(url).host.split('-')[1]);
    if (down.has(i)) throw new Error('nút tắt');
    try {
      const sealedShare = await handleRelease(JSON.parse(String(init!.body)), {
        programId: PROGRAM,
        keys: nodes[i],
        now: Math.floor(Date.now() / 1000),
        getVault: async (a) => chain.get(a) ?? null,
      });
      return new Response(JSON.stringify({ sealedShare }), { status: 200 });
    } catch (e) {
      const err = e as ReleaseError;
      return new Response(JSON.stringify({ error: err.message }), { status: err.status ?? 500 });
    }
  }) as typeof fetch;
}

describe('nút mở khoá theo ngưỡng 2/3', () => {
  it('chỉ trả khoá khi két đã được nhận, đúng người nhận; chịu được 1 nút tắt', async () => {
    const nodes = await makeNodes(3);
    const owner = Keypair.generate().publicKey;
    const heir = Keypair.generate();
    const stranger = Keypair.generate();
    const vault = Keypair.generate().publicKey.toBase58();
    const chain = new Map<string, VaultOnChain>([[vault, { owner: PROGRAM, data: vaultData(owner, heir.publicKey, false) }]]);
    const nodeList = nodes.map((n, i) => ({ url: `http://node-${i}`, publicKey: Buffer.from(n.publicKey).toString('base64') }));
    const vaultKey = new Uint8Array(32).map((_, i) => i + 1);
    const ctx = { vault, heir: heir.publicKey.toBase58(), programId: PROGRAM };

    const sealed = await new ThresholdCustodian(nodeList, 2).seal(vaultKey, ctx);
    expect(JSON.stringify(sealed)).not.toContain(Buffer.from(vaultKey).toString('base64'));

    const sign = (kp: Keypair) => async (m: Uint8Array) => ed25519.sign(m, kp.secretKey.slice(0, 32));
    const heirCustodian = new ThresholdCustodian(nodeList, 2, sign(heir), fakeNetwork(nodes, chain));

    // Chưa bàn giao → các nút từ chối.
    await expect(heirCustodian.open(sealed, ctx)).rejects.toThrow('Két chưa được bàn giao');

    chain.set(vault, { owner: PROGRAM, data: vaultData(owner, heir.publicKey, true) });
    expect(await heirCustodian.open(sealed, ctx)).toEqual(vaultKey);

    // Một nút tắt vẫn mở được (2/3); hai nút tắt thì không.
    const oneDown = new ThresholdCustodian(nodeList, 2, sign(heir), fakeNetwork(nodes, chain, new Set([1])));
    expect(await oneDown.open(sealed, ctx)).toEqual(vaultKey);
    const twoDown = new ThresholdCustodian(nodeList, 2, sign(heir), fakeNetwork(nodes, chain, new Set([0, 2])));
    await expect(twoDown.open(sealed, ctx)).rejects.toThrow('Chưa đủ nút');

    // Người lạ ký thay → bị từ chối.
    const strangerCustodian = new ThresholdCustodian(nodeList, 2, sign(stranger), fakeNetwork(nodes, chain));
    await expect(strangerCustodian.open(sealed, { ...ctx, heir: stranger.publicKey.toBase58() })).rejects.toThrow();
    await expect(strangerCustodian.open(sealed, ctx)).rejects.toThrow('Chữ ký không hợp lệ');

    // Tài khoản giả (không thuộc chương trình) → bị từ chối.
    chain.set(vault, { owner: Keypair.generate().publicKey.toBase58(), data: vaultData(owner, heir.publicKey, true) });
    await expect(heirCustodian.open(sealed, ctx)).rejects.toThrow('Không tìm thấy két');
  });

  it('mảnh của két này không dùng cho két khác', async () => {
    const nodes = await makeNodes(3);
    const heir = Keypair.generate();
    const owner = Keypair.generate().publicKey;
    const vaultA = Keypair.generate().publicKey.toBase58();
    const vaultB = Keypair.generate().publicKey.toBase58();
    const chain = new Map<string, VaultOnChain>([
      [vaultA, { owner: PROGRAM, data: vaultData(owner, heir.publicKey, false) }],
      [vaultB, { owner: PROGRAM, data: vaultData(owner, heir.publicKey, true) }],
    ]);
    const nodeList = nodes.map((n, i) => ({ url: `http://node-${i}`, publicKey: Buffer.from(n.publicKey).toString('base64') }));
    const sealedA = await new ThresholdCustodian(nodeList, 2).seal(new Uint8Array(32).fill(9), { vault: vaultA, heir: heir.publicKey.toBase58(), programId: PROGRAM });
    const c = new ThresholdCustodian(nodeList, 2, async (m) => ed25519.sign(m, heir.secretKey.slice(0, 32)), fakeNetwork(nodes, chain));
    // Xin mảnh của két A (chưa bàn giao) bằng cách khai là két B (đã bàn giao).
    await expect(c.open(sealedA, { vault: vaultB, heir: heir.publicKey.toBase58(), programId: PROGRAM })).rejects.toThrow('không thuộc két này');
  });

  it('chặn yêu cầu cũ', async () => {
    const [node] = await makeNodes(1);
    const heir = Keypair.generate();
    const req = { vault: Keypair.generate().publicKey.toBase58(), heir: heir.publicKey.toBase58(), sealedShare: 'x', replyPublicKey: 'x', timestamp: 1, signature: 'x' };
    await expect(handleRelease(req, { programId: PROGRAM, keys: node, now: 10_000, getVault: async () => null })).rejects.toThrow('hết hạn');
  });
});
