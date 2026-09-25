/**
 * Giải mã toàn bộ hạng mục của vault NGAY TRÊN TRÌNH DUYỆT bằng VaultKey đang mở.
 * Kết quả chỉ nằm trong bộ nhớ (cache TanStack Query, gcTime = 0) và bị xoá khi khoá phiên.
 */
import { useQuery } from '@tanstack/react-query';
import { decryptItem, type VaultItemData } from '@deathnote/crypto';
import type { VaultItemDto } from '@deathnote/api';
import { useVaultSession } from '../session/vaultSession';
import { useVaultItems } from './api-hooks';

export type DecryptedItem = { id: string; dto: VaultItemDto; data: VaultItemData; itemKey: Uint8Array };

export function useDecryptedItems() {
  const vaultKey = useVaultSession((s) => s.vaultKey);
  const items = useVaultItems(!!vaultKey);
  const decrypted = useQuery({
    queryKey: ['decrypted-items', items.dataUpdatedAt],
    enabled: !!vaultKey && !!items.data,
    gcTime: 0,
    queryFn: async (): Promise<DecryptedItem[]> => {
      const out: DecryptedItem[] = [];
      for (const dto of items.data ?? []) {
        const { data, itemKey } = await decryptItem(vaultKey!, dto);
        out.push({ id: dto.id!, dto, data, itemKey });
      }
      return out;
    },
  });
  return {
    items: decrypted.data ?? [],
    isLoading: items.isLoading || decrypted.isLoading,
    error: items.error ?? decrypted.error,
  };
}
