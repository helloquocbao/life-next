/**
 * Đọc/ghi trạng thái trên chuỗi qua TanStack Query. Bản demo-time làm mới mỗi 4 giây (1 "ngày").
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import {
  openAsHeir, openAsOwner, ownerStatus, parsePackage, sealVault, verifyHash,
  type VaultAccount, type VaultContent,
} from '@deathnote/chain';
import { config } from '../config';
import { useSession } from './session';

const REFRESH = config.demoTime ? 4_000 : 60_000;

export function useChainNow() {
  const { client } = useSession();
  return useQuery({ queryKey: ['now'], queryFn: () => client.chainNow(), refetchInterval: REFRESH });
}

export function useMyProfile() {
  const { client, me } = useSession();
  return useQuery({ queryKey: ['profile', me.toBase58()], queryFn: () => client.fetchProfile(me), refetchInterval: REFRESH });
}

/** Trạng thái hồ sơ của một chủ két bất kỳ (A của mình, hoặc A đã giao két cho mình). */
export function useOwnerStatus(owner: PublicKey | undefined) {
  const { client } = useSession();
  const now = useChainNow();
  const profile = useQuery({
    queryKey: ['profile', owner?.toBase58()],
    queryFn: () => client.fetchProfile(owner!),
    enabled: !!owner,
    refetchInterval: REFRESH,
  });
  const status = profile.data && now.data ? ownerStatus(config, profile.data.paidUntil, now.data) : undefined;
  return { profile: profile.data, status, isLoading: profile.isLoading || now.isLoading };
}

export function useMyVaults() {
  const { client, me } = useSession();
  return useQuery({ queryKey: ['vaults', me.toBase58()], queryFn: () => client.listOwnerVaults(me), refetchInterval: REFRESH });
}

export function useInboxVaults() {
  const { client, me } = useSession();
  return useQuery({ queryKey: ['inbox', me.toBase58()], queryFn: () => client.listHeirVaults(me), refetchInterval: REFRESH });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function usePay() {
  const { client } = useSession();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (months: number) => client.pay(months), onSuccess: invalidate });
}

/** Mở một két của chính mình (A): tải gói, kiểm tra hash trên chuỗi, giải mã bằng khoá chủ. */
export function useOwnVaultContent(vault: VaultAccount | null) {
  const { store, masterKey } = useSession();
  return useQuery({
    queryKey: ['content', vault?.address.toBase58(), vault?.uri, !!masterKey],
    queryFn: async () => {
      const bytes = await store.get(vault!.uri);
      await verifyHash(bytes, vault!.contentHash);
      return openAsOwner(parsePackage(bytes), masterKey!);
    },
    enabled: !!vault && !!masterKey,
    staleTime: Infinity,
  });
}

/** Tạo mới hoặc sửa két: mã hoá → tải lên → ghi lên chuỗi → (sửa) bỏ pin gói cũ. */
export function useSaveVault() {
  const { client, me, store, custodian, unlock } = useSession();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (args: { existing?: { vault: VaultAccount; vaultKey: Uint8Array }; heir: string; content: VaultContent }) => {
      const masterKey = await unlock();
      const heir = new PublicKey(args.heir);
      const address = args.existing ? args.existing.vault.address : await client.nextVaultAddress();
      // Đổi người nhận → khoá két mới, để người nhận cũ (nếu từng có gói cũ) không mở được bản mới.
      const keepKey = args.existing && args.existing.vault.heir.equals(heir) ? args.existing.vaultKey : undefined;
      const sealed = await sealVault({
        content: args.content,
        masterKey,
        ctx: { vault: address.toBase58(), heir: heir.toBase58(), owner: me.toBase58(), programId: client.programId.toBase58() },
        custodian,
        vaultKey: keepKey,
      });
      const uri = await store.put(sealed.bytes);
      if (args.existing) {
        await client.updateVault(args.existing.vault, heir, uri, sealed.hash);
        if (args.existing.vault.uri !== uri) await store.remove(args.existing.vault.uri).catch(() => undefined);
      } else {
        await client.createVault(heir, uri, sealed.hash);
      }
    },
    onSuccess: invalidate,
  });
}

export function useDeleteVault() {
  const { client, store } = useSession();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (vault: VaultAccount) => {
      await client.deleteVault(vault);
      await store.remove(vault.uri).catch(() => undefined);
    },
    onSuccess: invalidate,
  });
}

export function useCloseProfile() {
  const { client } = useSession();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: () => client.closeProfile(), onSuccess: invalidate });
}

export function useClaim() {
  const { client } = useSession();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (vault: VaultAccount) => client.claim(vault), onSuccess: invalidate });
}

/** B mở két đã nhận: tải gói, kiểm tra hash, xin khoá từ người giữ khoá, giải mã. */
export function useOpenAsHeir() {
  const { store, custodian } = useSession();
  return useMutation({
    mutationFn: async (vault: VaultAccount) => {
      const bytes = await store.get(vault.uri);
      await verifyHash(bytes, vault.contentHash);
      return openAsHeir(parsePackage(bytes), custodian);
    },
  });
}
