/**
 * Bản đồ trang của Admin Console.
 *
 * - `/auth/callback`: nhận redirect OIDC (không cần đăng nhập).
 * - Mọi trang còn lại nằm trong AuthGate + AdminLayout (sidebar trái / nội dung giữa).
 * - Mỗi trang được bọc RequirePermission: menu đã ẩn theo quyền, nhưng người dùng vẫn có thể gõ URL.
 */
import { createBrowserRouter } from 'react-router';
import { AuthGate } from './auth/AuthGate';
import { CallbackPage } from './auth/CallbackPage';
import { AdminLayout } from './layout/AdminLayout';
import { HomeRedirect, RequirePermission } from './layout/RequirePermission';
import { DashboardPage } from './pages/DashboardPage';
import { QueuePage } from './pages/QueuePage';
import { AuditPage } from './pages/AuditPage';
import { PolicyPage } from './pages/PolicyPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { Perm } from './lib/permissions';

export const router = createBrowserRouter([
  { path: '/auth/callback', element: <CallbackPage /> },
  {
    path: '/',
    element: (
      <AuthGate>
        <AdminLayout />
      </AuthGate>
    ),
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'dashboard', element: <RequirePermission permission={Perm.Dashboard}><DashboardPage /></RequirePermission> },
      { path: 'queue', element: <RequirePermission permission={Perm.Releases}><QueuePage /></RequirePermission> },
      { path: 'audit', element: <RequirePermission permission={Perm.AuditLog}><AuditPage /></RequirePermission> },
      { path: 'policy', element: <RequirePermission permission={Perm.Policy}><PolicyPage /></RequirePermission> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
