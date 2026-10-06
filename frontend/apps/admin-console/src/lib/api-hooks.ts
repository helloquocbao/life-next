/**
 * Hook TanStack Query cho các API của Admin Console. Mỗi hook = một endpoint, có kiểu đầy đủ
 * (đường dẫn/tham số kiểm tra theo schema.d.ts sinh từ OpenAPI của backend).
 *
 * Không có hook nào đọc nội dung két: backend không cung cấp API đó cho admin (zero-knowledge).
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  unwrap, type AdminProfileDto, type CreateStaffInput, type EmailTemplateDto, type LifecycleState, type PolicyDto, type UpdateEmailTemplateInput,
  type SaveRoleInput, type UpdatePolicyInput, type UpdateStaffInput,
} from '@deathnote/api';
import { parseUtc } from '@deathnote/ui';
import { api } from '../config';

export const qk = {
  profile: ['admin', 'profile'] as const,
  dashboard: ['admin', 'dashboard'] as const,
  policy: ['admin', 'policy'] as const,
  customers: (skip: number, take: number, filter?: string, state?: LifecycleState) => ['admin', 'customers', skip, take, filter, state] as const,
  staff: (skip: number, take: number, filter?: string, role?: string) => ['admin', 'staff', skip, take, filter, role] as const,
  staffAll: ['admin', 'staff'] as const,
  assignableRoles: ['admin', 'assignable-roles'] as const,
  roles: ['admin', 'roles'] as const,
  permissionCatalog: ['admin', 'permission-catalog'] as const,
  emailTemplates: ['admin', 'email-templates'] as const,
  emailDelivery: ['admin', 'email-delivery'] as const,
  emailPreview: (key: string, subject: string, bodyHtml: string) => ['admin', 'email-preview', key, subject, bodyHtml] as const,
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

/** Chính sách vòng đời. Chỉ gọi khi có quyền DeathNote.Policy — nếu không backend trả 403. */
export const usePolicy = (enabled: boolean) =>
  useQuery({
    queryKey: qk.policy,
    queryFn: () => unwrap(api.GET('/api/app/admin-dashboard/policy')),
    enabled,
    staleTime: 10 * 60_000,
  });

/** Lưu chính sách (quyền DeathNote.Policy.Manage) — có hiệu lực ngay, không cần duyệt. */
export function useUpdatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdatePolicyInput) => unwrap(api.PUT('/api/app/admin-dashboard/policy', { body })),
    onSuccess: (updated: PolicyDto) => qc.setQueryData(qk.policy, updated),
  });
}

/** Danh sách khách hàng (owner) — phân trang server, tìm theo tên/email/SĐT, lọc theo trạng thái. */
export const useCustomers = (skip: number, take: number, filter?: string, state?: LifecycleState) =>
  useQuery({
    queryKey: qk.customers(skip, take, filter, state),
    queryFn: () =>
      unwrap(api.GET('/api/app/admin-customer', {
        params: { query: { SkipCount: skip, MaxResultCount: take, Filter: filter || undefined, State: state } },
      })),
    placeholderData: keepPreviousData,
  });

/**
 * Email & SĐT đầy đủ của một khách hàng (quyền Customers.ViewContact). Là mutation, không cache: mỗi lần bấm "xem"
 * là một lần backend ghi audit — đúng với thao tác người dùng chủ động.
 */
export const useRevealContact = () =>
  useMutation({
    mutationFn: (id: string) => unwrap(api.GET('/api/app/admin-customer/{id}/contact', { params: { path: { id } } })),
  });

/** Danh sách nhân viên + vai trò. */
export const useStaff = (skip: number, take: number, filter?: string, role?: string) =>
  useQuery({
    queryKey: qk.staff(skip, take, filter, role),
    queryFn: () =>
      unwrap(api.GET('/api/app/admin-staff', {
        params: { query: { SkipCount: skip, MaxResultCount: take, Filter: filter || undefined, Role: role || undefined } },
      })),
    placeholderData: keepPreviousData,
  });

/** Thêm hoặc sửa nhân viên (quyền DeathNote.Staff.Manage). Xong thì làm mới danh sách. */
export function useSaveStaff(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateStaffInput | UpdateStaffInput) =>
      id
        ? unwrap(api.PUT('/api/app/admin-staff/{id}', { params: { path: { id } }, body: body as UpdateStaffInput }))
        : unwrap(api.POST('/api/app/admin-staff', { body: body as CreateStaffInput })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.staffAll }),
  });
}

/** Tên các vai trò gán được cho nhân viên (form + bộ lọc trang Nhân viên). */
export const useAssignableRoles = () =>
  useQuery({ queryKey: qk.assignableRoles, queryFn: () => unwrap(api.GET('/api/app/admin-staff/assignable-roles')) });

/** Danh sách vai trò kèm số nhân viên và quyền đã cấp. */
export const useRoles = () => useQuery({ queryKey: qk.roles, queryFn: () => unwrap(api.GET('/api/app/admin-role')) });

/** Cây quyền của console (không đổi lúc chạy → cache lâu). */
export const usePermissionCatalog = () =>
  useQuery({ queryKey: qk.permissionCatalog, queryFn: () => unwrap(api.GET('/api/app/admin-role/permissions')), staleTime: Infinity });

/** Tạo / sửa vai trò. Xong thì làm mới vai trò, danh sách vai trò gán được, nhân viên và quyền của chính mình. */
export function useSaveRole(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveRoleInput) =>
      id
        ? unwrap(api.PUT('/api/app/admin-role/{id}', { params: { path: { id } }, body }))
        : unwrap(api.POST('/api/app/admin-role', { body })),
    onSuccess: () => invalidateRoleData(qc),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/api/app/admin-role/{id}', { params: { path: { id } } })),
    onSuccess: () => invalidateRoleData(qc),
  });
}

function invalidateRoleData(qc: ReturnType<typeof useQueryClient>) {
  for (const key of [qk.roles, qk.assignableRoles, qk.staffAll, qk.profile]) void qc.invalidateQueries({ queryKey: key });
}

/** Audit log toàn hệ thống — phân trang server, lọc theo tiền tố hành động và OwnerId. */
export const useAuditLog = (skip: number, take: number, action?: string, ownerId?: string, enabled = true) =>
  useQuery({
    queryKey: qk.audit(skip, take, action, ownerId),
    queryFn: () =>
      unwrap(api.GET('/api/app/admin-audit', {
        params: { query: { SkipCount: skip, MaxResultCount: take, ActionPrefix: action || undefined, OwnerId: ownerId || undefined } },
      })),
    enabled,
    placeholderData: keepPreviousData,
  });

/** Kiểm tra toàn vẹn chuỗi băm audit log (POST — backend tính lại toàn bộ chuỗi SHA-256). */
export const useVerifyChain = () =>
  useMutation({ mutationFn: () => unwrap(api.POST('/api/app/admin-audit/verify-chain')) });

/** Danh sách mẫu email (nội dung đang áp dụng + mặc định). */
export const useEmailTemplates = () =>
  useQuery({
    queryKey: qk.emailTemplates,
    queryFn: async () => (await unwrap(api.GET('/api/app/email-template'))).items ?? [],
  });

/** Kênh gửi email đang dùng (Resend / SMTP) và địa chỉ người gửi. */
export const useEmailDeliveryInfo = () =>
  useQuery({ queryKey: qk.emailDelivery, queryFn: () => unwrap(api.GET('/api/app/email-template/delivery-info')), staleTime: 10 * 60_000 });

/**
 * Xem trước bản nháp (chưa lưu) — backend thay biến bằng giá trị mẫu và bọc khung chung.
 * Gọi lại khi bản nháp đổi (component tự debounce trước khi truyền vào).
 */
export const useEmailPreview = (key: string | undefined, draft: UpdateEmailTemplateInput) =>
  useQuery({
    queryKey: qk.emailPreview(key ?? '', draft.subject, draft.bodyHtml),
    queryFn: () => unwrap(api.POST('/api/app/email-template/{id}/preview', { params: { path: { id: key! } }, body: draft })),
    enabled: !!key && !!draft.subject.trim() && !!draft.bodyHtml.trim(),
    placeholderData: keepPreviousData,
    retry: false,
  });

function useUpdateTemplateCache() {
  const qc = useQueryClient();
  return (updated: EmailTemplateDto) =>
    qc.setQueryData<EmailTemplateDto[]>(qk.emailTemplates, (list) => list?.map((t) => (t.key === updated.key ? updated : t)));
}

export function useSaveEmailTemplate(key: string) {
  const update = useUpdateTemplateCache();
  return useMutation({
    mutationFn: (body: UpdateEmailTemplateInput) =>
      unwrap(api.PUT('/api/app/email-template/{id}', { params: { path: { id: key } }, body })),
    onSuccess: update,
  });
}

export function useResetEmailTemplate(key: string) {
  const update = useUpdateTemplateCache();
  return useMutation({
    mutationFn: () => unwrap(api.POST('/api/app/email-template/{id}/reset', { params: { path: { id: key } } })),
    onSuccess: update,
  });
}

export const useSendTestEmail = (key: string) =>
  useMutation({
    mutationFn: (body: UpdateEmailTemplateInput & { to: string }) =>
      unwrap(api.POST('/api/app/email-template/{id}/send-test', { params: { path: { id: key } }, body })),
  });
