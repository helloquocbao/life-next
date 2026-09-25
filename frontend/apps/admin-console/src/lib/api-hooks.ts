/**
 * Hook TanStack Query cho các API của Admin Console. Mỗi hook = một endpoint, có kiểu đầy đủ
 * (đường dẫn/tham số kiểm tra theo schema.d.ts sinh từ OpenAPI của backend).
 *
 * Không có hook nào đọc nội dung két: backend không cung cấp API đó cho admin (zero-knowledge).
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap, type AdminProfileDto, type ReleaseCaseDto } from '@deathnote/api';
import { parseUtc } from '@deathnote/ui';
import { api } from '../config';
import type { CastVoteInput, QueueTab } from './types';

export const qk = {
  profile: ['admin', 'profile'] as const,
  dashboard: ['admin', 'dashboard'] as const,
  policy: ['admin', 'policy'] as const,
  queue: (tab: QueueTab, skip: number, take: number) => ['admin', 'queue', tab, skip, take] as const,
  queueAll: ['admin', 'queue'] as const,
  case: (id: string) => ['admin', 'case', id] as const,
  audit: (skip: number, take: number, action?: string, ownerId?: string) => ['admin', 'audit', skip, take, action, ownerId] as const,
};

/** Hồ sơ admin + độ lệch đồng hồ giữa máy người dùng và server (dùng để tính "còn bao lâu" trong chế độ demo). */
export type AdminProfile = AdminProfileDto & { clockOffsetMs: number };

/**
 * Quyền + vai trò của người đang đăng nhập — nguồn duy nhất để dựng menu và ẩn/hiện khối chức năng.
 * Ít thay đổi nên cache lâu; mọi component gọi lại hook này đều dùng chung bản cache.
 */
export const useProfile = () =>
  useQuery({
    queryKey: qk.profile,
    queryFn: async (): Promise<AdminProfile> => {
      const dto = await unwrap(api.GET('/api/app/admin-dashboard/profile'));
      const server = parseUtc(dto.serverNow);
      return { ...dto, clockOffsetMs: server ? server.valueOf() - Date.now() : 0 };
    },
    staleTime: 5 * 60_000,
  });

/** Dashboard tổng hợp (chỉ số đếm, không danh tính). Làm mới 30 giây/lần. */
export const useDashboard = (enabled: boolean) =>
  useQuery({
    queryKey: qk.dashboard,
    queryFn: () => unwrap(api.GET('/api/app/admin-dashboard')),
    enabled,
    refetchInterval: 30_000,
  });

/** Chính sách vòng đời (read-only). Chỉ gọi khi có quyền DeathNote.Policy — nếu không backend trả 403. */
export const usePolicy = (enabled: boolean) =>
  useQuery({
    queryKey: qk.policy,
    queryFn: () => unwrap(api.GET('/api/app/admin-dashboard/policy')),
    enabled,
    staleTime: 10 * 60_000,
  });

/**
 * Hàng chờ mở vault — phân trang phía server, tự làm mới ~15 giây để người duyệt thấy hồ sơ mới
 * (trong chế độ demo thời gian nén, hồ sơ chuyển trạng thái rất nhanh).
 */
export const useReleaseQueue = (tab: QueueTab, skip: number, take: number, enabled = true) =>
  useQuery({
    queryKey: qk.queue(tab, skip, take),
    queryFn: () =>
      unwrap(api.GET('/api/app/release-review/queue', { params: { query: { Tab: tab, SkipCount: skip, MaxResultCount: take } } })),
    enabled,
    refetchInterval: 15_000,
    placeholderData: keepPreviousData, // chuyển trang không nháy bảng trống
  });

/** Hồ sơ chi tiết (5 khối). Tự làm mới 15 giây để thấy đồng thuận/bằng chứng mới khi đang mở drawer. */
export const useReleaseCase = (id: string | undefined) =>
  useQuery({
    queryKey: qk.case(id ?? ''),
    queryFn: () => unwrap(api.GET('/api/app/release-review/{id}', { params: { path: { id: id! } } })),
    enabled: !!id,
    refetchInterval: 15_000,
  });

/**
 * Bỏ phiếu thẩm định/phê duyệt (quy tắc 4 mắt được backend thực thi).
 * Thành công: ghi đè cache hồ sơ bằng bản mới server trả về + làm mới hàng chờ và dashboard.
 */
export function useCastVote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CastVoteInput) =>
      unwrap(api.POST('/api/app/release-review/{id}/vote', { params: { path: { id } }, body })),
    onSuccess: (updated: ReleaseCaseDto) => {
      qc.setQueryData(qk.case(id), updated);
      void qc.invalidateQueries({ queryKey: qk.queueAll });
      void qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

/** Audit log toàn hệ thống — phân trang server, lọc theo tiền tố hành động và OwnerId. */
export const useAuditLog = (skip: number, take: number, action?: string, ownerId?: string, enabled = true) =>
  useQuery({
    queryKey: qk.audit(skip, take, action, ownerId),
    queryFn: () =>
      unwrap(api.GET('/api/app/admin-audit', {
        params: { query: { SkipCount: skip, MaxResultCount: take, Action: action || undefined, OwnerId: ownerId || undefined } },
      })),
    enabled,
    placeholderData: keepPreviousData,
  });

/** Kiểm tra toàn vẹn chuỗi băm audit log (POST — backend tính lại toàn bộ chuỗi SHA-256). */
export const useVerifyChain = () =>
  useMutation({ mutationFn: () => unwrap(api.POST('/api/app/admin-audit/verify-chain')) });
