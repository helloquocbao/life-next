/**
 * KHÁCH HÀNG — danh sách owner đã hoàn tất thiết lập, để đội vận hành tra cứu và hỗ trợ.
 *
 * - Phân trang server; tìm theo tên / email / số điện thoại; lọc theo trạng thái vòng đời.
 * - Chỉ metadata: số người được uỷ quyền, số hạng mục két. Không có nội dung két (zero-knowledge).
 * - Email & SĐT luôn hiện dạng che. Ai có quyền `Customers.ViewContact` bấm 👁 để xem đầy đủ từng người
 *   (backend ghi audit mỗi lần xem); thông tin đã hiện chỉ giữ trên trang hiện tại.
 * - "Audit" mở nhật ký đã lọc sẵn theo khách hàng đó.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Input, Select, Space, Table, Tag, Tooltip, Typography, type TableColumnsType } from 'antd';
import { AuditOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { LifecycleState, type CustomerDto } from '@deathnote/api';
import { ErrorAlert, StatusTag, formatDate, formatDateTime, formatRelative, lifecycleStateColor, lifecycleStateLabel } from '@deathnote/ui';
import { useCustomers, useProfile } from '../lib/api-hooks';
import { CustomerContact } from '../components/customers/CustomerContact';
import { hasPerm, Perm } from '../lib/permissions';
import { PageTitle } from '../components/PageTitle';

const STATE_OPTIONS = Object.values(LifecycleState).map((s) => ({ value: s, label: lifecycleStateLabel[s] }));

export function CustomersPage() {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const canAudit = hasPerm(profile, Perm.AuditLog);
  const canViewContact = hasPerm(profile, Perm.CustomersViewContact);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filter, setFilter] = useState<string>();
  const [state, setState] = useState<LifecycleState>();
  const { data, isLoading, isFetching, error } = useCustomers((page - 1) * pageSize, pageSize, filter, state);

  const columns: TableColumnsType<CustomerDto> = [
    {
      title: 'Khách hàng', key: 'name', width: 260,
      render: (_, c) => (
        <div>
          <Typography.Text strong>{c.displayName}</Typography.Text>
          <CustomerContact customer={c} canReveal={canViewContact} />
        </div>
      ),
    },
    {
      title: 'Trạng thái', dataIndex: 'state', width: 190,
      render: (s: LifecycleState, c) => (
        <Space size={4} wrap>
          <StatusTag value={s} label={lifecycleStateLabel} color={lifecycleStateColor} />
          {c.pausedUntil && (
            <Tooltip title={`Tạm dừng đến ${formatDateTime(c.pausedUntil)}`}><Tag icon={<PauseCircleOutlined />}>Tạm dừng</Tag></Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Check-in gần nhất', dataIndex: 'lastCheckInAt', width: 150,
      render: (v?: string | null) => v ? <Tooltip title={formatDateTime(v)}>{formatRelative(v)}</Tooltip> : '—',
    },
    {
      title: 'Hạn check-in', dataIndex: 'nextCheckInDueAt', width: 150,
      render: (v: string, c) => (
        <div>
          {formatDateTime(v)}
          <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>mỗi {c.checkInIntervalDays} ngày · ân hạn {c.graceDays} ngày</Typography.Text></div>
        </div>
      ),
    },
    { title: 'Người được uỷ quyền', dataIndex: 'trusteeCount', width: 110, align: 'center' },
    { title: 'Hạng mục két', dataIndex: 'vaultItemCount', width: 100, align: 'center' },
    { title: 'Ngày tham gia', dataIndex: 'creationTime', width: 120, render: (v: string) => formatDate(v) },
    ...(canAudit ? [{
      key: 'actions', width: 90, fixed: 'right' as const,
      render: (_: unknown, c: CustomerDto) => (
        <Button size="small" icon={<AuditOutlined />} onClick={() => navigate(`/audit?ownerId=${c.id}`)}>Audit</Button>
      ),
    }] : []),
  ];

  return (
    <>
      <PageTitle title="Khách hàng" subtitle="Chủ hồ sơ đã hoàn tất thiết lập. Chỉ hiển thị metadata — không ai xem được nội dung két." />
      <ErrorAlert error={error} style={{ marginBottom: 12 }} />
      <div className="panel">
        <div className="panel-toolbar">
          <Space wrap>
            <Input.Search allowClear placeholder="Tên, email hoặc số điện thoại" style={{ width: 320 }}
              onSearch={(v) => { setFilter(v.trim() || undefined); setPage(1); }} />
            <Select allowClear placeholder="Trạng thái" style={{ width: 220 }} options={STATE_OPTIONS} value={state}
              onChange={(v?: LifecycleState) => { setState(v); setPage(1); }} />
          </Space>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Mới tham gia trước</Typography.Text>
        </div>
        <Table<CustomerDto>
          size="small"
          rowKey={(c) => c.id ?? ''}
          columns={columns}
          dataSource={data?.items ?? []}
          loading={isLoading || isFetching}
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page, pageSize, total: data?.totalCount ?? 0, showSizeChanger: true, pageSizeOptions: [20, 50, 100],
            showTotal: (t) => `${t} khách hàng`,
            onChange: (p, s) => { setPage(p); setPageSize(s); },
          }}
        />
      </div>
    </>
  );
}
