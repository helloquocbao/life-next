/**
 * Bản đồ trang của Owner Web.
 *   /onboarding   5 bước thiết lập (dưới 4 phút)
 *   /             Home — "Bạn đang ổn. Lần check-in tiếp theo: …"
 *   /vault        Két thông tin
 *   /assets       Tài sản & quyền lợi
 *   /recipients   Người nhận, ngưỡng m-of-n, phân bổ
 *   /dry-run      Diễn tập quy trình
 *   /settings     Cài đặt & an toàn
 *   /check-in     Check-in một chạm từ email/SMS (không cần đăng nhập)
 */
import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import { FullPageSpin, ErrorAlert } from '@deathnote/ui';
import { AuthGate } from './auth/AuthGate';
import { CallbackPage } from './auth/CallbackPage';
import { AppLayout } from './layout/AppLayout';
import { useOwnerStatus } from './lib/api-hooks';
import { HomePage } from './pages/HomePage';
import { OnboardingPage } from './pages/OnboardingPage';
import { VaultPage } from './pages/VaultPage';
import { AssetsPage } from './pages/AssetsPage';
import { RecipientsPage } from './pages/RecipientsPage';
import { SettingsPage } from './pages/SettingsPage';
import { DryRunPage } from './pages/DryRunPage';
import { CheckInLinkPage } from './pages/CheckInLinkPage';

/** Owner chưa thiết lập xong (chưa có hồ sơ hoặc chưa tạo két) → đưa về onboarding. */
function RequireOnboarded() {
  const status = useOwnerStatus();
  if (status.isLoading) return <FullPageSpin />;
  if (status.error) return <div className="page"><ErrorAlert error={status.error} /></div>;
  if (!status.data?.hasProfile || !status.data.vaultInitialized) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

export const router = createBrowserRouter([
  { path: '/auth/callback', element: <CallbackPage /> },
  { path: '/check-in', element: <CheckInLinkPage /> },
  { path: '/onboarding', element: <AuthGate><OnboardingPage /></AuthGate> },
  {
    path: '/',
    element: <AuthGate><AppLayout /></AuthGate>,
    children: [
      {
        element: <RequireOnboarded />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'vault', element: <VaultPage /> },
          { path: 'assets', element: <AssetsPage /> },
          { path: 'recipients', element: <RecipientsPage /> },
          { path: 'dry-run', element: <DryRunPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
