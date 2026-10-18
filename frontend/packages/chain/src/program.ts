/**
 * Gọi chương trình on-chain LifeNext (Anchor). Mỗi hàm = một giao dịch; ví người dùng ký.
 */
import { AnchorProvider, BN, Program, type Wallet } from '@anchor-lang/core';
import { Connection, PublicKey, SystemProgram, type TransactionInstruction } from '@solana/web3.js';
import idlJson from './idl/lifenext.json';
import type { Lifenext } from './idl/lifenext';
import type { ChainConfig } from './config';

export type ProfileAccount = {
  owner: PublicKey;
  paidUntil: number;
  debtSettledFor: number;
  nextVaultId: number;
  vaultCount: number;
  rentPayer: PublicKey;
  createdAt: number;
};

export type VaultAccount = {
  address: PublicKey;
  owner: PublicKey;
  heir: PublicKey;
  claimed: boolean;
  id: number;
  claimedAt: number;
  updatedAt: number;
  contentHash: number[];
  rentPayer: PublicKey;
  uri: string;
};

const PROFILE_SEED = new TextEncoder().encode('profile');
const VAULT_SEED = new TextEncoder().encode('vault');

/** Offset trong dữ liệu tài khoản Vault: discriminator 8 | owner 32 | heir 32 | claimed 1. */
export const VAULT_OWNER_OFFSET = 8;
export const VAULT_HEIR_OFFSET = 40;
export const VAULT_CLAIMED_OFFSET = 72;

const u32le = (n: number) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
};

export function createLifenext(connection: Connection, wallet: Wallet, cfg: ChainConfig) {
  const programId = new PublicKey(cfg.programId);
  const treasury = new PublicKey(cfg.treasury);
  const idl = { ...(idlJson as Lifenext), address: cfg.programId };
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  const program = new Program<Lifenext>(idl, provider);

  const profilePda = (owner: PublicKey) => PublicKey.findProgramAddressSync([PROFILE_SEED, owner.toBytes()], programId)[0];
  const vaultPda = (owner: PublicKey, id: number) =>
    PublicKey.findProgramAddressSync([VAULT_SEED, owner.toBytes(), u32le(id)], programId)[0];

  const toProfile = (p: Awaited<ReturnType<typeof program.account.profile.fetch>>): ProfileAccount => ({
    owner: p.owner,
    paidUntil: p.paidUntil.toNumber(),
    debtSettledFor: p.debtSettledFor.toNumber(),
    nextVaultId: p.nextVaultId,
    vaultCount: p.vaultCount,
    rentPayer: p.rentPayer,
    createdAt: p.createdAt.toNumber(),
  });

  const toVault = (address: PublicKey, v: Awaited<ReturnType<typeof program.account.vault.fetch>>): VaultAccount => ({
    address,
    owner: v.owner,
    heir: v.heir,
    claimed: v.claimed,
    id: v.id,
    claimedAt: v.claimedAt.toNumber(),
    updatedAt: v.updatedAt.toNumber(),
    contentHash: Array.from(v.contentHash),
    rentPayer: v.rentPayer,
    uri: v.uri,
  });

  const me = () => wallet.publicKey;

  return {
    program,
    programId,
    profilePda,
    vaultPda,

    /** Giờ trên chuỗi (dùng để tính trạng thái giống hệt chương trình, không phụ thuộc đồng hồ máy). */
    async chainNow(): Promise<number> {
      const slot = await connection.getSlot('confirmed');
      return (await connection.getBlockTime(slot)) ?? Math.floor(Date.now() / 1000);
    },

    async fetchProfile(owner: PublicKey = me()): Promise<ProfileAccount | null> {
      const p = await program.account.profile.fetchNullable(profilePda(owner));
      return p ? toProfile(p) : null;
    },

    async fetchVault(address: PublicKey): Promise<VaultAccount | null> {
      const v = await program.account.vault.fetchNullable(address);
      return v ? toVault(address, v) : null;
    },

    async listOwnerVaults(owner: PublicKey = me()): Promise<VaultAccount[]> {
      const all = await program.account.vault.all([{ memcmp: { offset: VAULT_OWNER_OFFSET, bytes: owner.toBase58() } }]);
      return all.map((a) => toVault(a.publicKey, a.account)).sort((a, b) => a.id - b.id);
    },

    /** Các két mà ví này là người nhận (B). */
    async listHeirVaults(heir: PublicKey = me()): Promise<VaultAccount[]> {
      const all = await program.account.vault.all([{ memcmp: { offset: VAULT_HEIR_OFFSET, bytes: heir.toBase58() } }]);
      return all.map((a) => toVault(a.publicKey, a.account));
    },

    /** Thanh toán = check-in. Lần đầu tự tạo hồ sơ trong cùng giao dịch. */
    async pay(months: number): Promise<string> {
      const owner = me();
      const pre: TransactionInstruction[] = [];
      if (!(await program.account.profile.fetchNullable(profilePda(owner))))
        pre.push(await program.methods.initProfile().accountsPartial({ payer: owner, owner, profile: profilePda(owner) }).instruction());
      return program.methods
        .pay(months)
        .accountsPartial({ payer: owner, owner, profile: profilePda(owner), treasury, systemProgram: SystemProgram.programId })
        .preInstructions(pre)
        .rpc();
    },

    /** Địa chỉ két sẽ được tạo tiếp theo (để mã hoá gói gắn với đúng két trước khi ghi lên chuỗi). */
    async nextVaultAddress(owner: PublicKey = me()): Promise<PublicKey> {
      const p = await program.account.profile.fetchNullable(profilePda(owner));
      return vaultPda(owner, p ? p.nextVaultId : 0);
    },

    async createVault(heir: PublicKey, uri: string, contentHash: Uint8Array): Promise<{ sig: string; vault: PublicKey }> {
      const owner = me();
      const pre: TransactionInstruction[] = [];
      const p = await program.account.profile.fetchNullable(profilePda(owner));
      if (!p) pre.push(await program.methods.initProfile().accountsPartial({ payer: owner, owner, profile: profilePda(owner) }).instruction());
      const vault = vaultPda(owner, p ? p.nextVaultId : 0);
      const sig = await program.methods
        .createVault(heir, uri, Array.from(contentHash))
        .accountsPartial({ payer: owner, owner, profile: profilePda(owner), vault, systemProgram: SystemProgram.programId })
        .preInstructions(pre)
        .rpc();
      return { sig, vault };
    },

    async updateVault(vault: VaultAccount, heir: PublicKey, uri: string, contentHash: Uint8Array): Promise<string> {
      return program.methods
        .updateVault(heir, uri, Array.from(contentHash))
        .accountsPartial({ owner: me(), vault: vault.address })
        .rpc();
    },

    async deleteVault(vault: VaultAccount): Promise<string> {
      const owner = me();
      return program.methods
        .deleteVault()
        .accountsPartial({ owner, profile: profilePda(owner), vault: vault.address, rentPayer: vault.rentPayer })
        .rpc();
    },

    async closeProfile(): Promise<string> {
      const owner = me();
      const p = await program.account.profile.fetch(profilePda(owner));
      return program.methods.closeProfile().accountsPartial({ owner, profile: profilePda(owner), rentPayer: p.rentPayer }).rpc();
    },

    /** B nhận két (trả phần A còn nợ nếu chưa ai trả). */
    async claim(vault: VaultAccount): Promise<string> {
      return program.methods
        .claim()
        .accountsPartial({
          heir: me(),
          profile: profilePda(vault.owner),
          vault: vault.address,
          treasury,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    },
  };
}

export type Lifenext_Client = ReturnType<typeof createLifenext>;
export { BN };
