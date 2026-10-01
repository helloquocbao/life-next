/** Trợ giúp nhãn khi trường enum trong DTO có thể vắng (OpenAPI sinh kiểu optional). */
import type { TrusteeRole } from '@deathnote/api';
import { trusteeRoleHint, trusteeRoleLabel } from '@deathnote/ui';

export const roleLabel = (r: TrusteeRole | undefined) => (r === undefined ? '—' : trusteeRoleLabel[r]);
export const roleHint = (r: TrusteeRole | undefined) => (r === undefined ? '' : trusteeRoleHint[r]);

/** Giải thích vai trò trong 3 câu — hiển thị ở màn hình lời mời. */
export const roleExplainer: Record<TrusteeRole, [string, string, string]> = {
  0: [
    'Bạn giữ một mảnh khoá — một mình mảnh này không mở được gì cả.',
    'Chỉ khi người ấy ngừng check-in lâu ngày và đủ số người giữ khoá cùng đồng ý, hồ sơ mới được mở sau khi PICO thẩm định.',
    'Trước lúc đó bạn không cần làm gì; người ấy có thể huỷ ở bất kỳ bước nào.',
  ],
  1: [
    'Bạn là người nhận một phần thông tin mà người ấy muốn để lại cho bạn.',
    'Phần này chỉ được mở khi đủ người giữ khoá đồng ý và PICO đã thẩm định.',
    'Trước lúc đó bạn không cần làm gì, và cũng không ai xem được nội dung — kể cả PICO.',
  ],
  2: [
    'Bạn là người có thể báo khi không liên lạc được với người ấy.',
    'Bạn có thể khởi tạo yêu cầu mở và nộp bằng chứng, nhưng không giữ mảnh khoá.',
    'Trước lúc đó bạn không cần làm gì; người ấy có thể huỷ ở bất kỳ bước nào.',
  ],
};
