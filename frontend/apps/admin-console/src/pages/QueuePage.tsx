/**
 * HÀNG CHỜ MỞ VAULT — màn hình quan trọng nhất của console.
 *
 * Quy trình thẩm định giống thẩm định hồ sơ bảo hiểm: người duyệt quét bảng để chọn hồ sơ khẩn nhất
 * (backend đã sắp: quá SLA trước, rồi hồ sơ chờ lâu nhất), bấm vào dòng → drawer chi tiết bên phải.
 *
 * - Tabs: pending (chờ thẩm định + cần bổ sung + chờ cuối) / consent (đang thu đồng thuận) / closed / all.
 * - Phân trang server; tự làm mới 15 giây (xem useReleaseQueue).
 * - Hồ sơ đang mở nằm trên URL `?case=<id>` → F5 không mất, có thể gửi link nội bộ cho người phiếu 2.
 */
import { useSearchParams } from 'react-router';
import { Space, Table, Tabs, Tag, Tooltip, Typography, type TableColumnsType } from 'antd';
import { ExclamationCircleFilled, WarningOutlined } from '@ant-design/icons';
import type { ReleaseQueueItemDto, ReleaseReason, ReleaseStatus, RiskSeverity } from '@deathnote/api';
import {
  ErrorAlert, businessRemaining, colors, formatDateTime, formatRelative, releaseReasonLabel, releaseStatusColor, releaseStatusLabel,
  riskSeverityColor, riskSeverityLabel,
} from '@deathnote/ui';
import { useProfile, useReleaseQueue } from '../lib/api-hooks';
import { useQueueUi } from '../lib/queue-store';
import type { QueueTab } from '../lib/types';
import { PageTitle } from '../components/PageTitle';
import { CaseDrawer } from '../components/case/CaseDrawer';

const TABS: { key: QueueTab; label: string }[] = [
  { key: 'pending', label: 'Chờ xử lý' },
  { key: 'consent', label: 'Đang thu đồng thuận' },
  { key: 'closed', label: 'Đã đóng' },
  { key: 'all', label: 'Tất cả' },
];

export function QueuePage() {
  const { tab, page, pageSize, setTab, setPage } = useQueueUi();
  const [params, setParams] = useSearchParams();
  const caseId = params.get('case') ?? undefined;
  const { data: profile } = useProfile();
  const { data, isLoading, isFetching, error } = useReleaseQueue(tab, (page - 1) * pageSize, pageSize);

  const openCase = (id?: string) => {
    const next = new URLSearchParams(params);
    if (id) next.set('case', id); else next.delete('case');
    setParams(next, { replace: !id });
  };

  const columns: TableColumnsType<ReleaseQueueItemDto> = [
    {
      title: 'Owner', dataIndex: 'ownerName', width: 150, ellipsis: true,
      render: (v: string | null) => <Typography.Text strong>{v || '—'}</Typography.Text>,
    },
    {
      title: 'Trạng thái', dataIndex: 'status', width: 170,
      render: (s: ReleaseStatus, r) => (
        <Space orientation="vertical" size={0}>
          <Tag color={releaseStatusColor[s]} style={{ marginInlineEnd: 0 }}>{releaseStatusLabel[s]}</Tag>
          {s === 4 && r.finalWaitUntil && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>đến {formatDateTime(r.finalWaitUntil)}</Typography.Text>
          )}
        </Space>
      ),
    },
    { title: 'Lý do', dataIndex: 'reason', width: 100, render: (v: ReleaseReason) => releaseReasonLabel[v] },
    {
      title: 'Đồng thuận', key: 'consent', width: 100, align: 'center',
      render: (_, r) => {
        const ok = (r.effectiveConsents ?? 0) >= (r.requiredConsents ?? 0);
        return <Typography.Text strong style={{ color: ok ? colors.primary : colors.amber }}>{r.effectiveConsents ?? 0}/{r.requiredConsents ?? 0}</Typography.Text>;
      },
    },
    {
      title: 'Bằng chứng', dataIndex: 'evidenceCount', width: 96, align: 'center',
      render: (v: number) => (v ? v : <Typography.Text type="danger">0</Typography.Text>),
    },
    {
      title: 'Rủi ro', key: 'risk', width: 120,
      render: (_, r) =>
        // maxRisk là null khi không có cờ nào (C# RiskSeverity?) dù schema khai báo không-null
        r.maxRisk == null || !r.riskFlagCount ? <Typography.Text type="secondary">Không có</Typography.Text> : (
          <Tag color={riskSeverityColor[r.maxRisk as RiskSeverity]} icon={r.maxRisk === 2 ? <WarningOutlined /> : undefined}>
            {riskSeverityLabel[r.maxRisk as RiskSeverity]} · {r.riskFlagCount} cờ
          </Tag>
        ),
    },
    {
      title: 'Vòng / Phiếu', key: 'round', width: 104,
      render: (_, r) => (
        <span>V{r.reviewRound ?? 1}{r.currentStage ? <> · phiếu <b>{r.currentStage}</b>/2</> : ''}</span>
      ),
    },
    {
      title: 'Hạn SLA', dataIndex: 'slaDueAt', width: 160,
      render: (v: string | null, r) => {
        if (!v) return <Typography.Text type="secondary">—</Typography.Text>;
        // Thời gian còn lại tính theo "giờ nghiệp vụ" (nhân hệ số nén demo) để khớp với chính sách SLA ngày.
        const rem = businessRemaining(v, profile?.clockOffsetMs ?? 0, profile?.timeScale ?? 1);
        return r.isSlaOverdue ? (
          <Space orientation="vertical" size={0}>
            <Typography.Text type="danger" strong><ExclamationCircleFilled /> Quá hạn</Typography.Text>
            <Typography.Text type="danger" style={{ fontSize: 12 }}>{formatDateTime(v)}</Typography.Text>
          </Space>
        ) : (
          <Space orientation="vertical" size={0}>
            <span>{formatDateTime(v)}</span>
            {rem && <Typography.Text type="secondary" style={{ fontSize: 12 }}>còn {rem.text}</Typography.Text>}
          </Space>
        );
      },
    },
    {
      title: 'Khởi tạo lúc', dataIndex: 'initiatedAt', width: 140,
      render: (v: string) => <Tooltip title={formatRelative(v)}>{formatDateTime(v)}</Tooltip>,
    },
  ];

  return (
    <>
      <PageTitle
        title="Hàng chờ mở vault"
        subtitle="Mỗi hồ sơ cần 2 phiếu độc lập: phiếu 1 (thẩm định) và phiếu 2 (phê duyệt) do hai người khác nhau thực hiện."
      />
      <ErrorAlert error={error} style={{ marginBottom: 12 }} />
      <div className="panel">
        <Tabs activeKey={tab} onChange={(k) => setTab(k as QueueTab)} items={TABS.map((t) => ({ key: t.key, label: t.label }))} />
        <Table<ReleaseQueueItemDto>
          className="queue-table"
          rowKey={(r) => r.id ?? ''}
          size="small"
          columns={columns}
          dataSource={data?.items ?? []}
          loading={isLoading || (isFetching && !data)}
          scroll={{ x: 'max-content' }}
          rowClassName={(r) => [r.isSlaOverdue ? 'row-overdue' : '', r.id === caseId ? 'ant-table-row-selected' : ''].join(' ')}
          onRow={(r) => ({ onClick: () => openCase(r.id) })}
          locale={{ emptyText: 'Không có hồ sơ nào trong mục này' }}
          pagination={{
            current: page,
            pageSize,
            total: data?.totalCount ?? 0,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            showTotal: (t) => `${t} hồ sơ`,
            onChange: setPage,
          }}
        />
      </div>
      <CaseDrawer caseId={caseId} onClose={() => openCase(undefined)} />
    </>
  );
}
