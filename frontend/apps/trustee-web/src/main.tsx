/**
 * Điểm khởi động Trustee Web — ứng dụng dành cho người được uỷ quyền (người thân của owner).
 *
 * Người dùng ứng dụng này gần như không bao giờ mở nó cho tới ngày cần — và hôm đó họ đang ở
 * trạng thái tâm lý tệ nhất. Vì vậy: web-first (không bắt cài app), mỗi màn hình một việc,
 * chữ to, tone bình thản, không hình ảnh tang tóc.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { AppProviders } from '@deathnote/ui';
import { router } from './router';
import { installAutoLock } from './session/inboxSession';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 5_000 },
  },
});

// Tự xoá nội dung đã giải mã khỏi bộ nhớ sau một thời gian không thao tác.
installAutoLock();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders variant="consumer">
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AppProviders>
  </StrictMode>,
);
