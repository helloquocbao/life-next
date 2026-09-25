/**
 * Lịch sử phiếu của mọi vòng thẩm định. Một vòng mới bắt đầu sau "Yêu cầu bổ sung":
 * khi trustee nộp thêm bằng chứng, hồ sơ quay lại phiếu 1 với số vòng tăng lên.
 */
import { Table, Tag, Typography, type TableColumnsType } from 'antd';
import type { ReviewDecision, ReviewVoteDto } from '@deathnote/api';
import { formatDateTime, reviewDecisionLabel } from '@deathnote/ui';

const decisionColor: Record<ReviewDecision, string> = { 0: 'green', 1: 'orange', 2: 'red' };

export function VoteHistory({ votes }: { votes: ReviewVoteDto[] }) {
  const columns: TableColumnsType<ReviewVoteDto> = [
    { title: 'Vòng', dataIndex: 'round', width: 60, align: 'center' },
    { title: 'Phiếu', dataIndex: 'stage', width: 110, render: (v: number) => (v === 1 ? '1 · Thẩm định' : '2 · Phê duyệt') },
    { title: 'Người bỏ phiếu', dataIndex: 'adminName', width: 140 },
    { title: 'Quyết định', dataIndex: 'decision', width: 130, render: (v: ReviewDecision) => <Tag color={decisionColor[v]}>{reviewDecisionLabel[v]}</Tag> },
    { title: 'Ghi chú', dataIndex: 'note', render: (v?: string | null) => v || <Typography.Text type="secondary">—</Typography.Text> },
    { title: 'Thời điểm', dataIndex: 'votedAt', width: 130, render: (v: string) => formatDateTime(v) },
  ];
  return (
    <Table<ReviewVoteDto> size="small" rowKey={(v) => `${v.round}-${v.stage}-${v.votedAt}`} columns={columns} dataSource={votes}
      pagination={false} scroll={{ x: 720 }} locale={{ emptyText: 'Chưa có phiếu nào' }} />
  );
}
