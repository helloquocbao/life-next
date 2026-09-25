/**
 * AUDIT LOG toàn hệ thống — bằng chứng cho kiểm toán bên thứ ba rằng mọi thao tác đều được ghi lại.
 *
 * - Phân trang server, mới nhất trước (theo Seq giảm dần). Lọc: tiền tố hành động + OwnerId.
 * - "Kiểm tra toàn vẹn chuỗi": backend tính lại chuỗi băm SHA-256 (mỗi sự kiện chứa hash của sự kiện trước)
 *   và báo vị trí gãy đầu tiên nếu có ai sửa/xoá bản ghi. Ở tầng CSDL, trigger append-only chặn UPDATE/DELETE.
 * - "Xuất CSV": xuất đúng trang đang xem (không tải toàn bộ log về trình duyệt).
 */
import { useState } from 'react';
import { Alert, Button, Card, Input, Select, Space, Table, Tag, Tooltip, Typography, type TableColumnsType } from 'antd';
import { DownloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import type { AuditActorType, AuditEventDto } from '@deathnote/api';
import { ErrorAlert, auditActionLabel, auditActorTypeLabel, formatDateTime } from '@deathnote/ui';
import { useAuditLog, useVerifyChain } from '../lib/api-hooks';
import { downloadCsv, toCsv } from '../lib/csv';
import { PageTitle } from '../components/PageTitle';

const ACTION_PREFIXES = [
  { value: 'owner.', label: 'owner. — Owner' },
  { value: 'vault.', label: 'vault. — Két dữ liệu (metadata)' },
  { value: 'trustee.', label: 'trustee. — Người được uỷ quyền' },
  { value: 'lifecycle.', label: 'lifecycle. — Vòng đời' },
  { value: 'release.', label: 'release. — Yêu cầu mở' },
];

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const actorColor: Record<AuditActorType, string> = { 0: 'default', 1: 'green', 2: 'blue', 3: 'purple', 4: 'orange' };

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [action, setAction] = useState<string | undefined>();
  const [ownerInput, setOwnerInput] = useState('');
  const [ownerId, setOwnerId] = useState<string | undefined>();
  const ownerInvalid = !!ownerInput.trim() && !GUID_RE.test(ownerInput.trim());

  const { data, isLoading, isFetching, error } = useAuditLog((page - 1) * pageSize, pageSize, action, ownerId);
  const verify = useVerifyChain();

  const applyOwner = () => {
    const v = ownerInput.trim();
    if (v && !GUID_RE.test(v)) return; // tránh gửi OwnerId sai định dạng → backend trả 400
    setOwnerId(v || undefined);
    setPage(1);
  };

  const exportCsv = () => {
    const rows = (data?.items ?? []).map((e) => [
      e.sequence, formatDateTime(e.occurredAt), auditActorTypeLabel[(e.actorType ?? 0) as AuditActorType], e.actorName,
      e.action, auditActionLabel[e.action ?? ''] ?? '', e.targetType, e.targetId, e.ownerId, e.detail, e.ipAddress, e.hash,
    ]);
    const csv = toCsv(['Seq', 'Thời gian', 'Loại tác nhân', 'Tác nhân', 'Mã hành động', 'Hành động', 'Loại đối tượng', 'Mã đối tượng', 'OwnerId', 'Chi tiết', 'IP', 'Hash'], rows);
    downloadCsv(`audit-log-trang-${page}.csv`, csv);
  };

  const columns: TableColumnsType<AuditEventDto> = [
    { title: 'Seq', dataIndex: 'sequence', width: 70, render: (v: number) => <span className="mono">{v}</span> },
    { title: 'Thời gian', dataIndex: 'occurredAt', width: 130, render: (v: string) => formatDateTime(v) },
    {
      title: 'Tác nhân', key: 'actor', width: 190,
      render: (_, e) => (
        <Space size={4} wrap>
          <Tag color={actorColor[(e.actorType ?? 0) as AuditActorType]} style={{ marginInlineEnd: 0 }}>{auditActorTypeLabel[(e.actorType ?? 0) as AuditActorType]}</Tag>
          <span>{e.actorName || '—'}</span>
        </Space>
      ),
    },
    {
      title: 'Hành động', dataIndex: 'action', width: 210,
      render: (v: string) => (
        <Tooltip title={<span className="mono">{v}</span>}>
          <span>{auditActionLabel[v] ?? v}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Đối tượng', key: 'target', width: 170,
      render: (_, e) => e.targetType ? (
        <Tooltip title={e.targetId}><span>{e.targetType}{e.targetId ? <Typography.Text type="secondary" className="mono"> {e.targetId.slice(0, 8)}…</Typography.Text> : null}</span></Tooltip>
      ) : '—',
    },
    {
      title: 'Chi tiết', dataIndex: 'detail',
      render: (v?: string | null) => v ? <Typography.Text style={{ fontSize: 13 }} ellipsis={{ tooltip: v }}>{v}</Typography.Text> : '—',
    },
    { title: 'IP', dataIndex: 'ipAddress', width: 120, render: (v?: string | null) => <span className="mono">{v || '—'}</span> },
    {
      title: 'Hash', dataIndex: 'hash', width: 110,
      render: (v?: string | null) => v ? <Tooltip title={<span className="mono">{v}</span>}><span className="mono">{v.slice(0, 10)}…</span></Tooltip> : '—',
    },
  ];

  const result = verify.data;

  return (
    <>
      <PageTitle
        title="Audit log"
        subtitle="Nhật ký chỉ-ghi-thêm của toàn hệ thống. Mỗi sự kiện chứa hash SHA-256 nối với sự kiện trước."
        extra={
          <Space>
            <Button icon={<SafetyCertificateOutlined />} loading={verify.isPending} onClick={() => verify.mutate()}>Kiểm tra toàn vẹn chuỗi</Button>
            <Button icon={<DownloadOutlined />} disabled={!data?.items?.length} onClick={exportCsv}>Xuất CSV</Button>
          </Space>
        }
      />

      <ErrorAlert error={verify.error} style={{ marginBottom: 12 }} />
      {result && (
        <Alert
          style={{ marginBottom: 12 }}
          type={result.isIntact ? 'success' : 'error'}
          showIcon
          closable={{ onClose: () => verify.reset() }}
          title={result.isIntact
            ? `Chuỗi toàn vẹn ✓ — đã kiểm tra ${result.totalEvents ?? 0} sự kiện`
            : `Chuỗi bị gãy tại seq ${result.firstBrokenSequence} (tổng ${result.totalEvents ?? 0} sự kiện)`}
          description={
            <>
              Mỗi sự kiện lưu hash SHA-256 của chính nó nối với hash của sự kiện liền trước — sửa hoặc xoá một bản ghi bất kỳ
              sẽ làm gãy chuỗi từ vị trí đó. Ở tầng CSDL, trigger append-only chặn mọi lệnh UPDATE/DELETE trên bảng audit.
              <br />Kiểm tra lúc {formatDateTime(result.checkedAt)}.
            </>
          }
        />
      )}

      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Select allowClear placeholder="Tiền tố hành động" style={{ width: 280 }} options={ACTION_PREFIXES} value={action}
            onChange={(v?: string) => { setAction(v); setPage(1); }} />
          <Space.Compact>
            <Input placeholder="OwnerId (GUID)" style={{ width: 330 }} value={ownerInput} allowClear status={ownerInvalid ? 'error' : undefined}
              onChange={(e) => { setOwnerInput(e.target.value); if (!e.target.value) { setOwnerId(undefined); setPage(1); } }}
              onPressEnter={applyOwner} />
            <Button type="primary" onClick={applyOwner} disabled={ownerInvalid}>Lọc</Button>
          </Space.Compact>
          {ownerInvalid && <Typography.Text type="danger" style={{ fontSize: 12 }}>OwnerId phải là GUID</Typography.Text>}
        </Space>
      </Card>

      <ErrorAlert error={error} style={{ marginBottom: 12 }} />
      <Table<AuditEventDto>
        size="small"
        rowKey={(e) => String(e.sequence)}
        columns={columns}
        dataSource={data?.items ?? []}
        loading={isLoading || isFetching}
        scroll={{ x: 1250 }}
        pagination={{
          current: page, pageSize, total: data?.totalCount ?? 0, showSizeChanger: true, pageSizeOptions: [20, 50, 100],
          showTotal: (t) => `${t} sự kiện`,
          onChange: (p, s) => { setPage(p); setPageSize(s); },
        }}
      />
    </>
  );
}
