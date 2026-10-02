import type { CSSProperties, ReactNode } from 'react';
import { Flex, Space } from 'antd';

/**
 * Hàng chia 2 vùng: nội dung bên trái co giãn/tự xuống dòng bên TRONG phần của nó, cụm hành động bên
 * phải luôn giữ nguyên vị trí (không bị đẩy lệch khi nội dung trái dài) — dùng cho tiêu đề trang lẫn
 * từng dòng trong danh sách (thẻ tên + tag bên trái, nút bấm bên phải).
 * Trước khi có component này, mỗi nơi tự viết `Flex` + style tay khác nhau → dễ lệch bố cục khi nội
 * dung trái dài hơn dự kiến (xem RecipientsPage.tsx, đã từng vỡ hàng nút khi có thêm dòng trạng thái).
 */
export function SplitRow({ left, right, align = 'start', gap = 12, style }: {
  left: ReactNode;
  right: ReactNode;
  align?: 'start' | 'center' | 'end';
  gap?: number;
  style?: CSSProperties;
}) {
  return (
    <Flex justify="space-between" align={align} wrap gap={gap} style={style}>
      <div style={{ flex: '1 1 280px', minWidth: 0 }}>{left}</div>
      {/* Không ép flexShrink:0 — nếu không, cụm nút không bao giờ tự xuống dòng và tràn khỏi thẻ trên màn hẹp. */}
      <Space wrap style={{ flex: '0 1 auto', minWidth: 0, maxWidth: '100%' }}>{right}</Space>
    </Flex>
  );
}
