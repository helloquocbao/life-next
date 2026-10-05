/**
 * Bản đồ trang của App — gộp 2 vai trò trên cùng 1 tài khoản/1 phiên đăng nhập:
 *
 *   VAI TRÒ OWNER (chủ két của mình):
 *   /onboarding   5 bước GIỚI THIỆU sản phẩm (chỉ xem + vài lựa chọn nhẹ — KHÔNG tạo két ở đây)
 *   /             Home — "Bạn đang ổn. Lần check-in tiếp theo: …"
 *   /vault        Két thông tin — nơi THẬT SỰ tạo két (đặt passphrase + 12 từ) khi vào lần đầu
 *   /assets       Tài sản & quyền lợi
 *   /recipients   Người thân: người nhắc nhở + người nhận thông tin, chọn thông tin cho từng người nhận
 *   /dry-run      Diễn tập quy trình
 *   /settings     Cài đặt & an toàn
 *   /check-in     Check-in một chạm từ email/SMS (không cần đăng nhập)
 *
 *   VAI TRÒ TRUSTEE (được người khác nhờ giữ khoá) — KHÔNG bắt buộc phải hoàn tất onboarding owner:
 *   /invite               Xem lời mời (công khai, chưa cần đăng nhập) — layout riêng, không có sidebar
 *   /assignments          "Hồ sơ tôi giữ giúp" — những owner đã giao mình vai trò (người nhắc nhở / người nhận thông tin)
 *   /inbox/:trusteeId     Hộp nhận sau khi hồ sơ owner đã được mở
 *
 * Cố ý tách "giới thiệu sản phẩm" khỏi "tạo két": bắt nhập mật khẩu chính + 12 từ khôi phục ngay
 * trong lúc giới thiệu (trước khi owner hiểu Két dùng để làm gì) gây rối. Việc tạo két được dời tới
 * đúng lúc owner bấm vào tính năng Két lần đầu (xem UnlockGate.tsx). Cùng lý do, các trang trustee
 * KHÔNG nằm sau RequireOnboarded — một tài khoản chỉ dùng để giữ khoá giúp người khác (chưa từng là
 * owner) không nên bị bắt đi qua 5 bước giới thiệu sản phẩm sở hữu két của chính mình.
 */
import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import { FullPageSpin, ErrorAlert } from '@deathnote/ui';
import { AuthGate } from './auth/AuthGate';
import { AppLayout } from './layout/AppLayout';
import { PublicLayout } from './components/trustee/PublicLayout';
import { useOwnerStatus } from './lib/api-hooks';
import { HomePage } from './pages/HomePage';
import { OnboardingPage } from './pages/OnboardingPage';
import { VaultPage } from './pages/VaultPage';
import { AssetsPage } from './pages/AssetsPage';
import { RecipientsPage } from './pages/RecipientsPage';
import { SettingsPage } from './pages/SettingsPage';
import { DryRunPage } from './pages/DryRunPage';
import { CheckInLinkPage } from './pages/CheckInLinkPage';
import { AssignmentsPage } from './pages/AssignmentsPage';
import { InboxPage } from './pages/InboxPage';
import { InvitePage } from './pages/InvitePage';

/**
 * Owner chưa xem giới thiệu → đưa về onboarding. Chỉ kiểm tra ĐÃ CÓ HỒ SƠ, không kiểm tra đã tạo
 * két hay chưa — tạo két là việc làm lúc vào tính năng Két, không phải điều kiện để dùng app.
 * Chỉ áp dụng cho các trang thuộc vai trò owner — xem router bên dưới.
 */
function RequireOnboarded() {
  const status = useOwnerStatus();
  if (status.isLoading) return <FullPageSpin />;
  if (status.error) return <div className="page"><ErrorAlert error={status.error} /></div>;
  if (!status.data?.hasProfile) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

export const router = createBrowserRouter([
  { path: '/check-in', element: <CheckInLinkPage /> },
  { path: '/invite', element: <PublicLayout><InvitePage /></PublicLayout> },
  { path: '/onboarding', element: <AuthGate><OnboardingPage /></AuthGate> },
  {
    path: '/',
    element: <AuthGate><AppLayout /></AuthGate>,
    children: [
      // Vai trò trustee — không cần đã onboard vai trò owner.
      { path: 'assignments', element: <AssignmentsPage /> },
      { path: 'inbox/:trusteeId', element: <InboxPage /> },
      // Vai trò owner — bắt buộc đã onboard.
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
