/**
 * Bản đồ trang của Admin Console.
 *
 * - Mọi trang nằm trong AuthGate (chưa đăng nhập → form đăng nhập REST tại chỗ) + AdminLayout.
 * - Mỗi trang được bọc RequirePermission: menu đã ẩn theo quyền, nhưng người dùng vẫn có thể gõ URL.
 */
import { createBrowserRouter } from 'react-router';
import { AuthGate } from './auth/AuthGate';
import { AdminLayout } from './layout/AdminLayout';
import { HomeRedirect, RequirePermission } from './layout/RequirePermission';
import { DashboardPage } from './pages/DashboardPage';
import { QueuePage } from './pages/QueuePage';
import { AuditPage } from './pages/AuditPage';
import { PolicyPage } from './pages/PolicyPage';
import { EmailTemplatesPage } from './pages/EmailTemplatesPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { Perm } from './lib/permissions';

export const router = createBrowserRouter([
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
      { path: 'email-templates', element: <RequirePermission permission={Perm.EmailTemplates}><EmailTemplatesPage /></RequirePermission> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
