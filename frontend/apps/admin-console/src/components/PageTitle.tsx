/** Tiêu đề trang thống nhất: tên trang + mô tả ngắn + vùng thao tác bên phải. */
import type { ReactNode } from 'react';
import { Typography } from 'antd';

export function PageTitle({ title, subtitle, extra }: { title: string; subtitle?: ReactNode; extra?: ReactNode }) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        {subtitle && <Typography.Text type="secondary" style={{ fontSize: 13 }}>{subtitle}</Typography.Text>}
      </div>
      {extra}
    </div>
  );
}
