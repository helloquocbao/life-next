/**
 * Danh sách hạng mục đã giải mã, nhóm theo loại. Mỗi dòng hiển thị người sẽ nhận dưới dạng avatar nhỏ.
 */
import { Avatar, Card, Empty, List, Space, Tooltip, Typography } from 'antd';
import { formatRelative } from '@deathnote/ui';
import { KINDS } from '../lib/itemKinds';
import type { DecryptedItem } from '../lib/useDecryptedItems';

export function ItemList({ items, section, recipientsOf, onOpen }: {
  items: DecryptedItem[];
  section: 'vault' | 'assets';
  recipientsOf: (id: string) => string[];
  onOpen: (item: DecryptedItem) => void;
}) {
  const kinds = KINDS.filter((k) => k.section === section);
  const groups = kinds.map((k) => ({ def: k, items: items.filter((i) => i.data.kind === k.kind) })).filter((g) => g.items.length);
  if (!groups.length) return <Card><Empty description="Chưa có hạng mục nào." /></Card>;

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {groups.map(({ def, items: list }) => (
        <Card key={def.kind} title={<Space>{def.emoji} {def.label} <Typography.Text type="secondary">({list.length})</Typography.Text></Space>} styles={{ body: { padding: 0 } }}>
          <List dataSource={list} renderItem={(it) => {
            const rec = recipientsOf(it.id);
            return (
              <List.Item onClick={() => onOpen(it)} style={{ cursor: 'pointer', paddingInline: 24 }}
                extra={
                  <Avatar.Group max={{ count: 3 }} size="small">
                    {rec.map((n) => <Tooltip key={n} title={n}><Avatar style={{ background: '#2f6f5e' }}>{n.split(' ').pop()?.[0]}</Avatar></Tooltip>)}
                  </Avatar.Group>
                }>
                <List.Item.Meta title={it.data.title}
                  description={<span className="muted">{rec.length ? `Người nhận: ${rec.join(', ')}` : 'Chưa phân cho ai'} · {formatRelative(it.dto.lastModificationTime ?? it.dto.creationTime)}</span>} />
              </List.Item>
            );
          }} />
        </Card>
      ))}
    </Space>
  );
}
