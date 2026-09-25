/**
 * Ma trận phân bổ "hạng mục × người nhận" — giải mã từ vault.encryptedAllocation bằng VaultKey.
 * Chỉ owner đọc được; server lưu ciphertext.
 */
import { useQuery } from '@tanstack/react-query';
import { decryptAllocation, type Allocation } from '@deathnote/crypto';
import { useVaultSession } from '../session/vaultSession';
import { useVault } from './api-hooks';

export function useAllocation() {
  const vaultKey = useVaultSession((s) => s.vaultKey);
  const vault = useVault();
  return useQuery({
    queryKey: ['allocation', vault.data?.keyVersion, vault.dataUpdatedAt],
    enabled: !!vaultKey && !!vault.data,
    gcTime: 0,
    queryFn: (): Promise<Allocation> => decryptAllocation(vaultKey!, vault.data!.encryptedAllocation),
  });
}

/** Danh sách tên người nhận của một hạng mục (để hiện avatar/tag nhỏ ở mỗi dòng). */
export function recipientsOf(allocation: Allocation | undefined, itemId: string, names: Map<string, string>): string[] {
  if (!allocation) return [];
  return Object.entries(allocation.assignments)
    .filter(([, ids]) => ids.includes(itemId))
    .map(([tid]) => names.get(tid))
    .filter((x): x is string => !!x);
}
