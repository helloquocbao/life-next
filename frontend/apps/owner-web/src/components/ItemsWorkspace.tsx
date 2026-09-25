/**
 * Khung làm việc chung cho "Két thông tin" và "Tài sản & quyền lợi": tìm kiếm, danh sách, xem, thêm, sửa, xoá.
 * Tìm kiếm chạy trên dữ liệu đã giải mã trong trình duyệt (server không có index nội dung).
 */
import { useMemo, useState, type ReactNode } from 'react';
import { App, Button, Flex, Input, Space, Typography } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@deathnote/api';
import { ErrorAlert, FullPageSpin } from '@deathnote/ui';
import { api } from '../config';
import { qk, useTrustees } from '../lib/api-hooks';
import { recipientsOf, useAllocation } from '../lib/useAllocation';
import { useDecryptedItems, type DecryptedItem } from '../lib/useDecryptedItems';
import { ItemEditor } from './ItemEditor';
import { ItemList } from './ItemList';
import { ItemViewer } from './ItemViewer';
import type { VaultItemKind } from '@deathnote/crypto';

export function ItemsWorkspace({ section, title, subtitle, header }: {
  section: 'vault' | 'assets';
  title: string;
  subtitle: string;
  header?: (open: (kind: VaultItemKind, title: string) => void, items: DecryptedItem[]) => ReactNode;
}) {
  const { items, isLoading, error } = useDecryptedItems();
  const allocation = useAllocation();
  const trustees = useTrustees();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<DecryptedItem>();
  const [editor, setEditor] = useState<{ open: boolean; item?: DecryptedItem; kind?: VaultItemKind; title?: string }>({ open: false });

  const names = useMemo(() => new Map((trustees.data ?? []).map((t) => [t.id!, t.displayName!])), [trustees.data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => !q || i.data.title.toLowerCase().includes(q) || i.data.fields.some((f) => !f.secret && f.value.toLowerCase().includes(q)));
  }, [items, search]);

  const remove = async (item: DecryptedItem) => {
    await unwrap(api.DELETE('/api/app/vault/{id}/item', { params: { path: { id: item.id } } }));
    await qc.invalidateQueries({ queryKey: qk.items });
    setViewing(undefined);
    message.success('Đã xoá.');
  };

  if (isLoading) return <FullPageSpin tip="Đang giải mã trên thiết bị…" />;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Flex justify="space-between" align="end" gap={12} wrap>
        <div>
          <Typography.Title level={2} style={{ margin: 0 }}>{title}</Typography.Title>
          <Typography.Text type="secondary">{subtitle}</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setEditor({ open: true })}>Thêm</Button>
      </Flex>
      <ErrorAlert error={error} />
      {header?.((kind, t) => setEditor({ open: true, kind, title: t }), items)}
      <Input size="large" prefix={<SearchOutlined />} placeholder="Tìm trong dữ liệu đã giải mã…" value={search} onChange={(e) => setSearch(e.target.value)} allowClear />
      <ItemList items={filtered} section={section} onOpen={setViewing} recipientsOf={(id) => recipientsOf(allocation.data, id, names)} />
      <ItemEditor open={editor.open} item={editor.item} presetKind={editor.kind} presetTitle={editor.title} section={section}
        onClose={() => setEditor({ open: false })} />
      <ItemViewer item={viewing} onClose={() => setViewing(undefined)} recipients={viewing ? recipientsOf(allocation.data, viewing.id, names) : []}
        onEdit={() => { setEditor({ open: true, item: viewing }); setViewing(undefined); }}
        onDelete={() => viewing && void remove(viewing)} />
    </Space>
  );
}
