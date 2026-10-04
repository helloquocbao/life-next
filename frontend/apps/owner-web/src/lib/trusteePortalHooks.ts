/**
 * Hook TanStack Query cho cổng người được uỷ quyền (/api/app/trustee-portal/*).
 * Mỗi hook = một endpoint, kiểu đầy đủ từ OpenAPI (schema.d.ts).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap, type ContactResponse } from '@deathnote/api';
import type { KeyringPayload } from '@deathnote/crypto';
import { api } from '../config';

export const qk = {
  invitation: (token: string) => ['trustee', 'invitation', token] as const,
  keyring: ['trustee', 'keyring'] as const,
  assignments: ['trustee', 'assignments'] as const,
  activity: (trusteeId: string) => ['trustee', 'activity', trusteeId] as const,
};

/** Lời mời (ẩn danh) — hiển thị trước khi đăng nhập. */
export const useInvitation = (token: string) =>
  useQuery({
    queryKey: qk.invitation(token),
    queryFn: () => unwrap(api.GET('/api/app/trustee-portal/invitation', { params: { query: { token } } })),
    enabled: !!token,
    retry: false,
  });

/** Khoá cá nhân của người dùng hiện tại (khoá riêng đã bọc bằng passphrase). */
export const useKeyring = (enabled = true) =>
  useQuery({ queryKey: qk.keyring, queryFn: () => unwrap(api.GET('/api/app/trustee-portal/keyring')), enabled });

/** Các hồ sơ mình là trustee — tự làm mới mỗi 10 giây để thấy chuyển trạng thái (đặc biệt khi demo). */
export const useAssignments = (enabled = true) =>
  useQuery({
    queryKey: qk.assignments,
    queryFn: () => unwrap(api.GET('/api/app/trustee-portal/assignments')),
    refetchInterval: 10_000,
    enabled,
  });

/** Nhật ký liên quan đến mình (chỉ tải khi mở Drawer). */
export const useActivity = (trusteeId: string, enabled: boolean) =>
  useQuery({
    queryKey: qk.activity(trusteeId),
    queryFn: () => unwrap(api.GET('/api/app/trustee-portal/activity/{trusteeId}', { params: { path: { trusteeId } } })),
    enabled,
  });

function useInvalidateTrustee() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['trustee'] });
}

export function useCreateKeyring() {
  const invalidate = useInvalidateTrustee();
  return useMutation({
    mutationFn: (body: KeyringPayload) => unwrap(api.POST('/api/app/trustee-portal/keyring', { body })),
    onSuccess: invalidate,
  });
}

export function useAcceptInvitation() {
  const invalidate = useInvalidateTrustee();
  return useMutation({
    mutationFn: (token: string) => unwrap(api.POST('/api/app/trustee-portal/accept-invitation', { body: { token } })),
    onSuccess: invalidate,
  });
}

export function useRespondContact() {
  const invalidate = useInvalidateTrustee();
  return useMutation({
    mutationFn: (body: { trusteeId: string; response: ContactResponse }) =>
      unwrap(api.POST('/api/app/trustee-portal/respond-contact', { body })),
    onSuccess: invalidate,
  });
}

export { useInvalidateTrustee };
