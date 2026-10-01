import { useState } from 'react';
import { Card, Space, Table, Tag } from 'antd';
import { type AuditEventDto } from '@deathnote/api';
import { ErrorAlert, auditActionLabel, auditActorTypeLabel, checkInChannelLabel, formatDateTime, parseUtc } from '@deathnote/ui';
import { useActivity, useHeartbeats } from '../../lib/api-hooks';

export function ActivityTab() {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const activity = useActivity((page - 1) * pageSize, pageSize);
  const heartbeats = useHeartbeats();
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="Nhật ký hoạt động" extra={<span className="muted">Append-only · mỗi dòng có mã băm nối chuỗi</span>} styles={{ body: { padding: 0 } }}>
        <ErrorAlert error={activity.error} />
        <Table<AuditEventDto> rowKey="sequence" size="small" loading={activity.isLoading} dataSource={activity.data?.items ?? []}
          scroll={{ x: 720 }}
          pagination={{ current: page, pageSize, total: activity.data?.totalCount ?? 0, onChange: setPage, showSizeChanger: false }}
          columns={[
            { title: 'Thời gian', dataIndex: 'occurredAt', width: 150, render: (v) => formatDateTime(v) },
            { title: 'Ai', render: (_, e) => <span>{e.actorName ?? auditActorTypeLabel[e.actorType ?? 0]} <span className="muted">({auditActorTypeLabel[e.actorType ?? 0]})</span></span> },
            { title: 'Hành động', dataIndex: 'action', render: (a: string) => auditActionLabel[a] ?? a },
            { title: 'Chi tiết', dataIndex: 'detail', ellipsis: true },
            { title: 'IP', dataIndex: 'ipAddress', width: 120 },
          ]} />
      </Card>
      <Card title="Lịch sử check-in" styles={{ body: { padding: 0 } }}>
        <Table rowKey={(h) => h.occurredAt ?? ''} size="small" loading={heartbeats.isLoading} dataSource={heartbeats.data ?? []} pagination={{ pageSize: 10 }}
          scroll={{ x: 480 }}
          columns={[
            { title: 'Thời gian', dataIndex: 'occurredAt', render: (v) => formatDateTime(v) },
            { title: 'Kênh', dataIndex: 'channel', render: (c: 0 | 1 | 2 | 3) => checkInChannelLabel[c] },
            { title: 'IP', dataIndex: 'ipAddress' },
            { title: '', dataIndex: 'wasVeto', render: (v) => (v ? <Tag color="red">Phủ quyết</Tag> : null) },
          ]} />
      </Card>
      <span style={{ display: 'none' }}>{String(parseUtc)}</span>
    </Space>
  );
}
