/**
 * TÀI SẢN & QUYỀN LỢI — khác biệt lớn nhất so với password manager.
 * Thiết kế kiểu checklist có gợi ý: app chủ động hỏi từng câu (Có / Không / Để sau) thay vì đưa bảng trống.
 * Kèm "Bản đồ tài sản": loại → số lượng → người phụ trách — thứ gia đình xem đầu tiên khi được mở.
 */
import { useMemo, useState } from 'react';
import { Button, Card, Col, Progress, Row, Space, Table, Tag, Typography } from 'antd';
import type { VaultItemKind } from '@deathnote/crypto';
import { UnlockGate } from '../components/UnlockGate';
import { ItemsWorkspace } from '../components/ItemsWorkspace';
import { ASSET_QUESTIONS, KINDS } from '../lib/itemKinds';
import { useOwnerStatus, useTrustees } from '../lib/api-hooks';
import { useAllocation } from '../lib/useAllocation';
import type { DecryptedItem } from '../lib/useDecryptedItems';

type Answer = 'yes' | 'no' | 'later';

/** Câu trả lời Có/Không/Để sau chỉ là tiến độ cá nhân (không nhạy cảm) → lưu localStorage của trình duyệt. */
function useAnswers(userKey: string) {
  const storageKey = `dn-asset-answers:${userKey}`;
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? '{}'); } catch { return {}; }
  });
  const set = (id: string, a: Answer) => {
    const next = { ...answers, [id]: a };
    setAnswers(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* bỏ qua */ }
  };
  return [answers, set] as const;
}

function Questionnaire({ open, items }: { open: (k: VaultItemKind, t: string) => void; items: DecryptedItem[] }) {
  const status = useOwnerStatus();
  const [answers, setAnswer] = useAnswers(status.data?.email ?? 'me');
  const pending = ASSET_QUESTIONS.filter((q) => !answers[q.id] || answers[q.id] === 'later');
  const answered = ASSET_QUESTIONS.length - pending.length;
  const current = pending[0];

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={12}>
        <Card title="Vài câu hỏi nhanh" style={{ height: '100%' }}
          extra={<Typography.Text type="secondary">{answered}/{ASSET_QUESTIONS.length}</Typography.Text>}>
          <Progress percent={Math.round((answered / ASSET_QUESTIONS.length) * 100)} showInfo={false} />
          {current ? (
            <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 16 }}>
              <Typography.Title level={4} style={{ margin: 0 }}>{current.question}</Typography.Title>
              <Space wrap>
                <Button type="primary" onClick={() => { setAnswer(current.id, 'yes'); open(current.kind, current.suggestedTitle); }}>Có</Button>
                <Button onClick={() => setAnswer(current.id, 'no')}>Không</Button>
                <Button type="text" onClick={() => setAnswer(current.id, 'later')}>Để sau</Button>
              </Space>
            </Space>
          ) : (
            <Typography.Paragraph style={{ marginTop: 16 }}>Bạn đã trả lời hết. Có thể thêm tài sản khác bằng nút "Thêm".</Typography.Paragraph>
          )}
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <AssetMap items={items} />
      </Col>
    </Row>
  );
}

/** Bản đồ tài sản: loại → số lượng → người phụ trách. */
function AssetMap({ items }: { items: DecryptedItem[] }) {
  const allocation = useAllocation();
  const trustees = useTrustees();
  const names = useMemo(() => new Map((trustees.data ?? []).map((t) => [t.id!, t.displayName!])), [trustees.data]);
  const rows = KINDS.filter((k) => k.section === 'assets').map((k) => {
    const list = items.filter((i) => i.data.kind === k.kind);
    const owners = new Set<string>();
    for (const [tid, ids] of Object.entries(allocation.data?.assignments ?? {})) {
      if (list.some((i) => ids.includes(i.id)) && names.get(tid)) owners.add(names.get(tid)!);
    }
    return { key: k.kind, label: `${k.emoji} ${k.label}`, count: list.length, owners: [...owners] };
  });
  return (
    <Card title="Bản đồ tài sản" style={{ height: '100%' }} styles={{ body: { padding: 0 } }}>
      {/* Không cuộn ngang: cột hẹp + tag tự xuống dòng để vừa màn hình điện thoại (~340px). */}
      <Table size="small" pagination={false} dataSource={rows} tableLayout="fixed" columns={[
        { title: 'Loại', dataIndex: 'label' },
        { title: 'Số', dataIndex: 'count', width: 52, align: 'center' },
        { title: 'Người phụ trách', dataIndex: 'owners', width: '38%', render: (o: string[]) => o.length ? o.map((n) => <Tag key={n} style={{ marginBottom: 4, whiteSpace: 'normal' }}>{n}</Tag>) : <span className="muted">—</span> },
      ]} />
    </Card>
  );
}

export function AssetsPage() {
  return (
    <UnlockGate>
      <div className="page">
        <ItemsWorkspace section="assets" title="Tài sản & quyền lợi"
          subtitle="Bảo hiểm, BHXH, ngân hàng, bất động sản, đầu tư, khoản vay và các khoản định kỳ cần huỷ."
          header={(open, items) => <Questionnaire open={open} items={items} />} />
      </div>
    </UnlockGate>
  );
}
