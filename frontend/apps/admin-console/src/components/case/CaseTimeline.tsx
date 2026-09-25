/**
 * KHỐI 2 — Timeline: dựng lại câu chuyện của hồ sơ theo thời gian
 * (check-in cuối của owner → nhắc nhở → chuyển trạng thái → trustee khởi tạo/đồng thuận/nộp bằng chứng → phiếu).
 * Người duyệt dùng khối này để phát hiện bất thường, vd. owner vừa check-in ngay trước khi có yêu cầu mở.
 */
import { Timeline, Typography, type TimelineProps } from 'antd';
import type { TimelineEntryDto } from '@deathnote/api';
import { formatDateTime } from '@deathnote/ui';

/** Màu chấm theo loại sự kiện: xanh = owner còn sống/hoạt động, đỏ = kết thúc tiêu cực, cam = leo thang. */
function colorOf(kind?: string | null): string {
  if (!kind) return 'gray';
  if (kind === 'heartbeat' || kind === 'owner.veto') return 'green';
  if (kind === 'release.rejected' || kind === 'release.cancelled') return 'red';
  if (kind === 'lifecycle.state_changed' || kind === 'release.initiated') return 'orange';
  if (kind.startsWith('release.')) return 'blue';
  return 'gray';
}

export function CaseTimeline({ entries }: { entries: TimelineEntryDto[] }) {
  if (!entries.length) return <Typography.Text type="secondary">Chưa có sự kiện.</Typography.Text>;
  const items: NonNullable<TimelineProps['items']> = entries.map((e, i) => ({
    key: `${e.at}-${i}`,
    color: colorOf(e.kind),
    title: <Typography.Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatDateTime(e.at)}</Typography.Text>,
    content: (
      <div>
        <Typography.Text strong style={{ fontSize: 13 }}>{e.title}</Typography.Text>
        {e.detail && <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{e.detail}</Typography.Text></div>}
      </div>
    ),
  }));
  return <Timeline mode="start" titleSpan={5} items={items} />;
}
