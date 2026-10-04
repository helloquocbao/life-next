/**
 * Nội dung hướng dẫn sử dụng (driver.js) của Owner Web.
 * Các bước chỉ vào đúng phần tử có `data-tour="..."` trong AppLayout/HomePage.
 */
import type { DriveStep } from '@deathnote/ui';

export const HOME_TOUR_KEY = 'owner-home';

export function getHomeTourSteps(): DriveStep[] {
  return [
    {
      element: '[data-tour="status-ring"]',
      popover: {
        title: 'Chào mừng bạn 👋',
        description: 'Đây là toàn bộ những gì bạn cần biết mỗi khi mở Death Note: bạn đang ổn, và còn bao lâu nữa tới lần xác nhận tiếp theo.',
      },
    },
    {
      element: '[data-tour="checkin-button"]',
      popover: {
        title: 'Chỉ cần bấm nút này',
        description: 'Mỗi khi bạn thấy ổn, hãy bấm "Tôi vẫn ổn". Chỉ một chạm, không cần làm gì thêm. Nếu có cảnh báo, nút này cũng dùng để huỷ ngay lập tức.',
      },
    },
    {
      element: '[data-tour="next-action"]',
      popover: {
        title: 'Việc tiếp theo',
        description: 'Chúng tôi luôn gợi ý đúng MỘT việc bạn nên làm — không bắt bạn phải tự nghĩ xem nên làm gì.',
      },
    },
    {
      element: '[data-tour="more-details"]',
      popover: {
        title: 'Xem thêm nếu muốn',
        description: 'Các con số và chi tiết được giấu bớt ở đây để màn hình chính luôn gọn gàng. Bấm vào để xem thêm bất cứ lúc nào.',
      },
    },
    {
      element: '[data-tour="nav-vault"]',
      popover: {
        title: 'Két thông tin',
        description: 'Nơi bạn cất mật khẩu, giấy tờ, và những lá thư muốn để lại cho người thân.',
      },
    },
    {
      element: '[data-tour="nav-assets"]',
      popover: {
        title: 'Tài sản & quyền lợi',
        description: 'Chúng tôi sẽ hỏi bạn từng câu đơn giản (có sổ BHXH không? có nhà đất không?...) thay vì bắt bạn tự điền một bảng trống.',
      },
    },
    {
      element: '[data-tour="nav-recipients"]',
      popover: {
        title: 'Người thân',
        description: 'Chọn người nhắc nhở (được báo trước để nhắc bạn bấm nút) và người nhận thông tin (tự động nhận đúng phần bạn cho phép nếu bạn vẫn không bấm).',
      },
    },
    {
      element: '[data-tour="nav-settings"]',
      popover: {
        title: 'Cài đặt',
        description: 'Đổi nhịp xác nhận, mật khẩu chính, hoặc bật chế độ tạm dừng khi đi xa ở đây.',
      },
    },
    {
      element: '[data-tour="lock-toggle"]',
      popover: {
        title: 'Khoá lại bất cứ lúc nào',
        description: 'Thông tin của bạn tự khoá sau 10 phút không dùng. Muốn khoá ngay lập tức, bấm vào đây.',
      },
    },
    {
      element: '[data-tour="user-menu"]',
      popover: {
        title: 'Xem lại hướng dẫn này',
        description: 'Muốn xem lại hướng dẫn bất cứ lúc nào, mở menu này và chọn "Hướng dẫn sử dụng".',
      },
    },
  ];
}
