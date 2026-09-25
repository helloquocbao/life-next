/**
 * Điểm khởi động Admin Console — công cụ của đội vận hành PICO.
 *
 * Nguyên tắc nghiệp vụ: admin là người THẨM ĐỊNH HỒ SƠ (gần quy trình thẩm định bảo hiểm),
 * KHÔNG phải người quản trị dữ liệu. Console không có — và không được có — chức năng xem nội dung két.
 * Tone: chuyên nghiệp, gọn, mật độ thông tin cao (theme `admin`).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { AppProviders } from '@deathnote/ui';
import { router } from './router';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 5_000 },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders variant="admin">
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AppProviders>
  </StrictMode>,
);
