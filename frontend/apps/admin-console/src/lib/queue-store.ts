/**
 * Trạng thái giao diện của hàng chờ (tab + trang) giữ trong zustand để khi người duyệt
 * rời sang Audit log rồi quay lại, họ vẫn ở đúng vị trí đang xử lý.
 * (Hồ sơ đang mở được giữ trên URL `?case=<id>` để có thể gửi link cho đồng nghiệp phiếu 2.)
 */
import { create } from 'zustand';
import type { QueueTab } from './types';

type QueueUiState = {
  tab: QueueTab;
  page: number;
  pageSize: number;
  setTab: (tab: QueueTab) => void;
  setPage: (page: number, pageSize: number) => void;
};

export const useQueueUi = create<QueueUiState>((set) => ({
  tab: 'pending',
  page: 1,
  pageSize: 20,
  setTab: (tab) => set({ tab, page: 1 }), // đổi tab thì quay về trang 1
  setPage: (page, pageSize) => set({ page, pageSize }),
}));
