/** Trợ giúp nhãn khi trường enum trong DTO có thể vắng (OpenAPI sinh kiểu optional). */
import type { TrusteeRole } from '@deathnote/api';
import { trusteeRoleHint, trusteeRoleLabel } from '@deathnote/ui';

export const roleLabel = (r: TrusteeRole | undefined) => (r === undefined ? '—' : trusteeRoleLabel[r]);
export const roleHint = (r: TrusteeRole | undefined) => (r === undefined ? '' : trusteeRoleHint[r]);

/** Giải thích vai trò trong 3 câu — hiển thị ở màn hình lời mời. */
export const roleExplainer: Record<TrusteeRole, [string, string, string]> = {
  1: [
    'Bạn là người nhận một phần thông tin mà người ấy muốn để lại cho bạn.',
    'Nếu một ngày người ấy ngừng xác nhận mình vẫn ổn, và sau thời gian chờ vẫn không phản hồi, phần này sẽ tự động được gửi cho bạn.',
    'Trước lúc đó bạn không cần làm gì thêm (ngoài việc tạo khoá cá nhân ở bước tiếp theo), và không ai xem được nội dung — kể cả PICO.',
  ],
  2: [
    'Bạn là người được báo trước tiên nếu người ấy không còn bấm "Tôi vẫn ổn".',
    'Việc của bạn là liên lạc với họ và nhắc họ mở ứng dụng bấm nút. Nếu họ vẫn không phản hồi sau thời gian chờ, thông tin sẽ tự động được gửi cho người nhận.',
    'Bạn không nhận và không xem được bất kỳ thông tin nào trong két, và không cần tạo khoá.',
  ],
};
