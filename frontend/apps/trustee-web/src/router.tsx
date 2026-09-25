/**
 * Bảng định tuyến của Trustee Web.
 *
 * - `/invite?token=…` và `/auth/callback`: công khai (xem lời mời không cần đăng nhập).
 * - Còn lại nằm sau AuthGate: Home, tạo khoá cá nhân, hộp nhận.
 */
import { createBrowserRouter, Navigate } from 'react-router';
import { AuthGate } from './auth/AuthGate';
import { CallbackPage } from './auth/CallbackPage';
import { AppLayout } from './components/AppLayout';
import { HomePage } from './pages/HomePage';
import { InvitePage } from './pages/InvitePage';
import { KeyringPage } from './pages/KeyringPage';
import { InboxPage } from './pages/InboxPage';

export const router = createBrowserRouter([
  { path: '/auth/callback', element: <CallbackPage /> },
  {
    path: '/invite',
    element: (
      <AppLayout>
        <InvitePage />
      </AppLayout>
    ),
  },
  {
    element: (
      <AuthGate>
        <AppLayout />
      </AuthGate>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'keyring', element: <KeyringPage /> },
      { path: 'inbox/:trusteeId', element: <InboxPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
