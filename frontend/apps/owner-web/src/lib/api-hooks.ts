/**
 * Hook TanStack Query cho các API của owner. Mỗi hook = một endpoint, có kiểu đầy đủ.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap, type CompleteOnboardingInput, type SaveTrusteeInput } from '@deathnote/api';
import { api } from '../config';

export const qk = {
  status: ['owner', 'status'] as const,
  vault: ['vault'] as const,
  items: ['vault', 'items'] as const,
  trustees: ['trustees'] as const,
  heartbeats: ['owner', 'heartbeats'] as const,
  activity: (skip: number) => ['owner', 'activity', skip] as const,
  dryRun: ['owner', 'dry-run'] as const,
};

/** Trạng thái Home — tự làm mới mỗi 10 giây để thấy chuyển trạng thái (đặc biệt trong chế độ demo). */
export const useOwnerStatus = () =>
  useQuery({ queryKey: qk.status, queryFn: () => unwrap(api.GET('/api/app/owner/status')), refetchInterval: 10_000 });

export const useVault = () => useQuery({ queryKey: qk.vault, queryFn: () => unwrap(api.GET('/api/app/vault')) });

export const useVaultItems = (enabled = true) =>
  useQuery({ queryKey: qk.items, queryFn: () => unwrap(api.GET('/api/app/vault/items')), enabled });

export const useTrustees = () =>
  useQuery({ queryKey: qk.trustees, queryFn: () => unwrap(api.GET('/api/app/trustee')), refetchInterval: 15_000 });

export const useHeartbeats = () =>
  useQuery({ queryKey: qk.heartbeats, queryFn: () => unwrap(api.GET('/api/app/owner/heartbeats')) });

export const useActivity = (skip: number, take = 20) =>
  useQuery({
    queryKey: qk.activity(skip),
    queryFn: () => unwrap(api.GET('/api/app/owner/activity', { params: { query: { SkipCount: skip, MaxResultCount: take } } })),
  });

export const useDryRun = () => useQuery({ queryKey: qk.dryRun, queryFn: () => unwrap(api.GET('/api/app/owner/dry-run')) });

/** Làm mới mọi dữ liệu của owner sau một thao tác thay đổi trạng thái. */
export function useInvalidateOwner() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function useCompleteOnboarding() {
  const invalidate = useInvalidateOwner();
  return useMutation({
    mutationFn: (body: CompleteOnboardingInput) => unwrap(api.POST('/api/app/owner/complete-onboarding', { body })),
    onSuccess: invalidate,
  });
}

/** Check-in không yêu cầu 2FA — 2FA chỉ áp dụng ở bước mở két, xem UnlockGate. */
export function useCheckIn() {
  const invalidate = useInvalidateOwner();
  return useMutation({
    mutationFn: () => unwrap(api.POST('/api/app/owner/check-in', { body: {} })),
    onSuccess: invalidate,
  });
}

export function useSaveTrustee() {
  const invalidate = useInvalidateOwner();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: SaveTrusteeInput }) =>
      id
        ? unwrap(api.PUT('/api/app/trustee/{id}', { params: { path: { id } }, body }))
        : unwrap(api.POST('/api/app/trustee', { body })),
    onSuccess: invalidate,
  });
}
