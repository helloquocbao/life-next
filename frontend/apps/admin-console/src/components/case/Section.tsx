/** Khung một khối trong drawer hồ sơ: đánh số thứ tự đọc để người duyệt đi đúng trình tự thẩm định. */
import type { ReactNode } from 'react';
import { Card } from 'antd';

export function Section({ index, title, extra, children }: { index?: number; title: ReactNode; extra?: ReactNode; children: ReactNode }) {
  return (
    <Card size="small" className="case-section" title={<span>{index ? `${index}. ` : ''}{title}</span>} extra={extra}>
      {children}
    </Card>
  );
}
