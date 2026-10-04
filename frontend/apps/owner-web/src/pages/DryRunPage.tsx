/**
 * DIỄN TẬP (DRY RUN) — tính năng tạo niềm tin mạnh nhất, đưa vào MVP.
 * Mô phỏng toàn bộ quy trình để owner thấy từng người nhận sẽ nhận được gì. KHÔNG ai bị thông báo,
 * trạng thái không thay đổi. Phần "mỗi người nhận được gì" được giải mã ngay trên trình duyệt của owner.
 */
import { useMemo } from 'react';
import { Link } from 'react-router';
import { Alert, Button, Card, Col, Empty, List, Row, Space, Steps, Tag, Typography } from 'antd';
import { TrusteeRole, TrusteeStatus } from '@deathnote/api';
import { ErrorAlert, FullPageSpin, colors, trusteeRoleLabel } from '@deathnote/ui';
import { UnlockGate } from '../components/UnlockGate';
import { useDryRun, useOwnerStatus, useTrustees } from '../lib/api-hooks';
import { useAllocation } from '../lib/useAllocation';
import { useDecryptedItems } from '../lib/useDecryptedItems';
import { kindDef } from '../lib/itemKinds';

export function DryRunPage() {
  const dry = useDryRun();
  const status = useOwnerStatus();
  if (dry.isLoading) return <FullPageSpin />;
  if (dry.error || !dry.data) return <div className="page"><ErrorAlert error={dry.error} /></div>;
  const d = dry.data;

  return (
    <div className="page">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Typography.Title level={2} style={{ margin: 0 }}>Diễn tập quy trình</Typography.Title>
          <Typography.Text type="secondary">Chế độ mô phỏng — không ai nhận được thông báo, không có gì thay đổi.</Typography.Text>
        </div>
        {d.isReady
          ? <Alert type="success" showIcon title="Hồ sơ của bạn đã sẵn sàng cho quy trình bàn giao." />
          : <Alert type="warning" showIcon title="Còn vài việc trước khi quy trình có thể chạy trọn vẹn:"
              description={<ul style={{ margin: 0, paddingLeft: 18 }}>{d.blockers?.map((b) => <li key={b}>{b}</li>)}</ul>}
              action={<Link to="/recipients"><Button size="small">Sửa ngay</Button></Link>} />}

        <Card title={`Nếu ${status.data?.displayName ?? 'bạn'} im lặng…`} extra={<span className="muted">tổng cộng tối thiểu ~{Math.round(d.totalDays ?? 0)} ngày</span>}>
          <Steps direction="vertical" current={-1} items={(d.steps ?? []).map((s) => ({
            title: <Space>{s.title}{(s.durationDays ?? 0) > 0 && <Tag>{s.durationDays! < 1 ? `${Math.round(s.durationDays! * 24)} giờ` : `${s.durationDays} ngày`}</Tag>}</Space>,
            description: <div>{s.description}{s.ownerCanCancel && <div style={{ color: colors.primary, fontSize: 13 }}>✓ Bạn vẫn có thể huỷ bằng một chạm</div>}</div>,
          }))} />
        </Card>

        <UnlockGate reason="Mở khoá để xem trước chính xác từng người nhận sẽ nhận được gì.">
          <RecipientPreview />
        </UnlockGate>
      </Space>
    </div>
  );
}

/** Mỗi người nhận sẽ thấy: thư mở đầu → danh sách hạng mục được phân (giống hệt màn hình hộp nhận của trustee). */
function RecipientPreview() {
  const trustees = useTrustees();
  const allocation = useAllocation();
  const { items } = useDecryptedItems();
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const recipients = (trustees.data ?? []).filter((t) => t.role === TrusteeRole.Recipient && t.status === TrusteeStatus.Confirmed);
  if (!recipients.length) return <Card><Empty description="Chưa có người nhận thông tin nào hoàn tất lời mời." /></Card>;

  return (
    <Row gutter={[16, 16]}>
      {recipients.map((t) => {
        const assigned = (allocation.data?.assignments[t.id!] ?? []).map((id) => byId.get(id)).filter(Boolean);
        const letter = allocation.data?.letters[t.id!];
        return (
          <Col xs={24} md={12} key={t.id}>
            <Card title={t.displayName} extra={<Tag>{trusteeRoleLabel[t.role ?? TrusteeRole.Recipient]}</Tag>} style={{ height: '100%' }}>
              {letter
                ? <Card size="small" style={{ background: colors.primarySoft, borderColor: colors.primarySoft, marginBottom: 12 }}><i style={{ whiteSpace: 'pre-wrap' }}>"{letter}"</i></Card>
                : <div className="muted" style={{ marginBottom: 12 }}>Chưa có thư mở đầu.</div>}
              <List size="small" dataSource={assigned} locale={{ emptyText: 'Không nhận hạng mục nào' }}
                renderItem={(it) => <List.Item>{kindDef(it!.data.kind).emoji} {it!.data.title}</List.Item>} />
            </Card>
          </Col>
        );
      })}
    </Row>
  );
}
