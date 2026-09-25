/**
 * Tên quyền của Admin Console — PHẢI khớp `DeathNotePermissions.cs` ở backend.
 *
 * Ma trận phân quyền nội bộ (theo tài liệu thiết kế):
 *   Role        | Xem hồ sơ          | Duyệt   | Chính sách | Audit
 *   Support     | Có (ẩn bằng chứng) | Không   | Không      | Không
 *   Reviewer    | Có                 | Phiếu 1 | Không      | Có
 *   Approver    | Có                 | Phiếu 2 | Không      | Có
 *   Compliance  | Có                 | Không   | Xem        | Toàn bộ
 *   Super admin | Có                 | KHÔNG   | Quản lý    | Toàn bộ
 *
 * Lưu ý: ẩn menu/nút ở frontend chỉ để trải nghiệm gọn gàng — backend mới là nơi thực thi quyền.
 */
import type { AdminProfileDto } from '@deathnote/api';

export const Perm = {
  Dashboard: 'DeathNote.Dashboard',
  Releases: 'DeathNote.Releases',
  Evidence: 'DeathNote.Releases.Evidence',
  Review: 'DeathNote.Releases.Review',
  Approve: 'DeathNote.Releases.Approve',
  AuditLog: 'DeathNote.AuditLog',
  Policy: 'DeathNote.Policy',
} as const;

export type PermissionName = (typeof Perm)[keyof typeof Perm];

export function hasPerm(profile: AdminProfileDto | undefined, permission: PermissionName): boolean {
  return !!profile?.grantedPermissions?.includes(permission);
}

/** Nhãn tiếng Việt cho vai trò nội bộ (tên role ở backend: DeathNoteConsts.Roles). */
export const adminRoleLabel: Record<string, string> = {
  support: 'Hỗ trợ',
  reviewer: 'Thẩm định viên',
  approver: 'Người phê duyệt',
  compliance: 'Tuân thủ',
  admin: 'Quản trị hệ thống',
};

export const adminRoleColor: Record<string, string> = {
  support: 'default',
  reviewer: 'blue',
  approver: 'geekblue',
  compliance: 'purple',
  admin: 'magenta',
};
