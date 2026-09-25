/**
 * Hướng dẫn sử dụng dạng "product tour" (driver.js) — dùng chung cho cả 3 app.
 * https://driverjs.com/docs/installation
 *
 * Vì sao chọn driver.js: nhẹ (~5KB), không phụ thuộc framework, có sẵn khái niệm
 * "đèn chiếu vào một phần tử + hộp giải thích" — đúng nhu cầu chỉ dẫn từng bước cho
 * người không rành công nghệ (đã nêu trong yêu cầu thiết kế UI đơn giản).
 *
 * Cách dùng ở mỗi app:
 *   1. Gắn `data-tour="ten-buoc"` vào phần tử cần chỉ vào trong JSX.
 *   2. Gọi `createTour([{ element: '[data-tour="ten-buoc"]', popover: {...} }])`.
 *   3. `tour.drive()` để chạy.
 */
import { driver, type Config, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import './tour.css';

export type { DriveStep };

export type CreateTourOptions = Partial<Config> & {
  /** Gọi khi tour kết thúc (bấm Xong) HOẶC bị đóng giữa chừng (bấm X / Esc / click nền). */
  onFinish?: () => void;
};

/** Tạo một tour với nhãn tiếng Việt và theme màu của sản phẩm (xem tour.css). */
export function createTour(steps: DriveStep[], options: CreateTourOptions = {}) {
  const { onFinish, ...rest } = options;
  return driver({
    animate: true,
    showProgress: true,
    allowClose: true,
    overlayOpacity: 0.65,
    stagePadding: 8,
    stageRadius: 10,
    popoverOffset: 12,
    smoothScroll: true,
    popoverClass: 'ln-tour-popover',
    progressText: 'Bước {{current}} / {{total}}',
    nextBtnText: 'Tiếp theo',
    prevBtnText: 'Quay lại',
    doneBtnText: 'Xong',
    onDestroyed: () => onFinish?.(),
    steps,
    ...rest,
  });
}

/**
 * Đã xem hướng dẫn này chưa? Lưu trong localStorage của trình duyệt (chỉ là tiện ích hiển thị,
 * không phải dữ liệu nghiệp vụ) để tự động chạy một lần cho người dùng mới, không làm phiền lần sau.
 */
export function hasSeenTour(key: string): boolean {
  try {
    return localStorage.getItem(`ln-tour-seen:${key}`) === '1';
  } catch {
    return true; // an toàn: nếu không đọc được storage thì coi như đã xem, tránh làm phiền
  }
}

export function markTourSeen(key: string): void {
  try {
    localStorage.setItem(`ln-tour-seen:${key}`, '1');
  } catch {
    /* bỏ qua — không có storage cũng không sao */
  }
}
