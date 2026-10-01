/**
 * Điểm khởi động App — gộp Owner Web (chủ két) + Trustee Web (người được uỷ quyền) thành 1 ứng dụng,
 * vì 1 tài khoản có thể vừa là owner vừa là trustee của người khác. Tone: bình thản, sạch,
 * "yên tâm chứ không phải đang làm thủ tục".
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { AppProviders } from '@deathnote/ui';
import { router } from './router';
import { installAutoLock as installInboxAutoLock } from './session/inboxSession';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 5_000 },
  },
});

// Tự xoá nội dung hộp nhận (trustee) đã giải mã khỏi bộ nhớ sau một thời gian không thao tác.
// Khoá két (owner, VaultKey) có auto-lock riêng, cài trong layout/AppLayout.tsx.
installInboxAutoLock();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders variant="consumer">
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AppProviders>
  </StrictMode>,
);
