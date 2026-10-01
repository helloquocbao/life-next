/** Bản đồ tài sản: nhóm hạng mục theo loại → số lượng. Cái nhìn tổng quan trước khi đi vào chi tiết. */
import { Card, Col, Row, Statistic } from 'antd';
import type { VaultItemData, VaultItemKind } from '@deathnote/crypto';
import { itemKindLabel, kindDisplayOrder } from '../../lib/itemKinds';

export function AssetMap({ items }: { items: { id: string; data: VaultItemData }[] }) {
  const counts = new Map<VaultItemKind, number>();
  for (const { data } of items) counts.set(data.kind, (counts.get(data.kind) ?? 0) + 1);
  const kinds = kindDisplayOrder.filter((k) => counts.has(k));
  if (kinds.length === 0) return null;

  return (
    <Card title="Bản đồ tài sản" style={{ marginBottom: 24 }}>
      <Row gutter={[16, 16]}>
        {kinds.map((k) => (
          <Col key={k} xs={12} sm={8}>
            <Statistic title={itemKindLabel[k]} value={counts.get(k)} />
          </Col>
        ))}
      </Row>
    </Card>
  );
}
