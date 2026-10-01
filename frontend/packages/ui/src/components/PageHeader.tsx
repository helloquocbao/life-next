import type { ReactNode } from 'react';
import { Typography } from 'antd';
import { SplitRow } from './SplitRow';

/** Tiêu đề trang chuẩn: tên trang + mô tả ngắn bên trái, một hành động chính (nếu có) bên phải. */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <SplitRow align="end" gap={12}
      left={
        <div>
          <Typography.Title level={2} style={{ margin: 0 }}>{title}</Typography.Title>
          {subtitle && <Typography.Text type="secondary">{subtitle}</Typography.Text>}
        </div>
      }
      right={action} />
  );
}
