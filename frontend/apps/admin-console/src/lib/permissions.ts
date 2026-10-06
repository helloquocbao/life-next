/**
 * Tên quyền của Admin Console — PHẢI khớp `DeathNotePermissions.cs` ở backend.
 *
 * Phân quyền MẶC ĐỊNH khi vai trò được tạo lần đầu — sau đó admin chỉnh ở màn hình "Vai trò":
 *   Role        | Dashboard | Khách hàng | Nhân viên | Chính sách | Audit
 *   Support     | Có        | Xem        | Không     | Không      | Không
 *   Reviewer    | Có        | Xem        | Không     | Không      | Có
 *   Approver    | Có        | Xem        | Không     | Không      | Có
 *   Compliance  | Có        | Xem        | Xem       | Xem        | Toàn bộ
 *   Super admin | Có        | Xem        | Quản lý   | Chỉnh sửa  | Toàn bộ
 *
 * Lưu ý: ẩn menu/nút ở frontend chỉ để trải nghiệm gọn gàng — backend mới là nơi thực thi quyền.
 */
import type { AdminProfileDto } from '@deathnote/api';

export const Perm = {
  Dashboard: 'DeathNote.Dashboard',
  Customers: 'DeathNote.Customers',
  CustomersViewContact: 'DeathNote.Customers.ViewContact',
  Staff: 'DeathNote.Staff',
  StaffCreate: 'DeathNote.Staff.Create',
  StaffUpdate: 'DeathNote.Staff.Update',
  StaffLock: 'DeathNote.Staff.Lock',
  StaffResetPassword: 'DeathNote.Staff.ResetPassword',
  Roles: 'DeathNote.Roles',
  RolesCreate: 'DeathNote.Roles.Create',
  RolesUpdate: 'DeathNote.Roles.Update',
  RolesDelete: 'DeathNote.Roles.Delete',
  AuditLog: 'DeathNote.AuditLog',
  Policy: 'DeathNote.Policy',
  PolicyManage: 'DeathNote.Policy.Manage',
  EmailTemplates: 'DeathNote.EmailTemplates',
  EmailTemplatesManage: 'DeathNote.EmailTemplates.Manage',
} as const;

export type PermissionName = (typeof Perm)[keyof typeof Perm];

export function hasPerm(profile: AdminProfileDto | undefined, permission: PermissionName): boolean {
  return !!profile?.grantedPermissions?.includes(permission);
}

/** Nhãn tiếng Việt cho các vai trò mặc định; vai trò admin tự tạo hiển thị đúng tên đã đặt (xem `roleLabel`). */
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

export const roleLabel = (name: string) => adminRoleLabel[name] ?? name;
export const roleColor = (name: string) => adminRoleColor[name] ?? 'cyan';
