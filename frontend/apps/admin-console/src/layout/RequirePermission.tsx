/**
 * Chặn trang theo quyền + chọn trang mặc định sau khi đăng nhập.
 *
 * Trang chủ `/` chuyển tới trang đầu tiên người dùng có quyền theo thứ tự ưu tiên
 * Dashboard → Khách hàng → Nhân viên → Audit log → Vai trò → Chính sách → Mẫu email (vd. tài khoản chỉ có quyền audit sẽ vào thẳng Audit log).
 */
import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { Result } from 'antd';
import { FullPageSpin } from '@deathnote/ui';
import { useProfile } from '../lib/api-hooks';
import { hasPerm, Perm, type PermissionName } from '../lib/permissions';

const HOME_ORDER: { permission: PermissionName; path: string }[] = [
  { permission: Perm.Dashboard, path: '/dashboard' },
  { permission: Perm.Customers, path: '/customers' },
  { permission: Perm.Staff, path: '/staff' },
  { permission: Perm.AuditLog, path: '/audit' },
  { permission: Perm.Roles, path: '/roles' },
  { permission: Perm.Policy, path: '/policy' },
  { permission: Perm.EmailTemplates, path: '/email-templates' },
];

export function HomeRedirect() {
  const { data: profile } = useProfile();
  if (!profile) return <FullPageSpin />;
  const first = HOME_ORDER.find((x) => hasPerm(profile, x.permission));
  // Không có quyền nào thì AdminLayout đã hiển thị màn hình "không có quyền" trước khi tới đây.
  return first ? <Navigate to={first.path} replace /> : null;
}

export function RequirePermission({ permission, children }: { permission: PermissionName; children: ReactNode }) {
  const { data: profile } = useProfile();
  if (!profile) return <FullPageSpin />;
  if (!hasPerm(profile, permission))
    return <Result status="403" title="Không có quyền" subTitle="Vai trò của bạn không được truy cập trang này." />;
  return <>{children}</>;
}
