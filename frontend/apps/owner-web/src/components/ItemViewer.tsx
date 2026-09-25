/**
 * Xem chi tiết hạng mục. Trường nhạy cảm mặc định bị che; bấm để hiện và tự che lại sau 30 giây
 * (bản web thay cho "chạm + sinh trắc" của app iOS).
 */
import { useEffect, useState } from 'react';
import { Button, Descriptions, Drawer, Image, Popconfirm, Space, Tag, Typography } from 'antd';
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { fromBase64 } from '@deathnote/crypto';
import { formatBytes, formatDateTime } from '@deathnote/ui';
import { kindDef } from '../lib/itemKinds';
import type { DecryptedItem } from '../lib/useDecryptedItems';

export function ItemViewer({ item, onClose, onEdit, onDelete, recipients }: {
  item?: DecryptedItem;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  recipients: string[];
}) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  useEffect(() => setRevealed({}), [item?.id]);
  useEffect(() => {
    if (!Object.values(revealed).some(Boolean)) return;
    const t = window.setTimeout(() => setRevealed({}), 30_000);
    return () => window.clearTimeout(t);
  }, [revealed]);

  if (!item) return null;
  const def = kindDef(item.data.kind);

  const download = (name: string, type: string, b64: string) => {
    const url = URL.createObjectURL(new Blob([fromBase64(b64) as BlobPart], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Drawer open onClose={onClose} size="large" title={<Space>{def.emoji} {item.data.title}</Space>}
      extra={
        <Space>
          <Popconfirm title="Xoá hạng mục này?" okText="Xoá" cancelText="Không" onConfirm={onDelete}>
            <Button danger>Xoá</Button>
          </Popconfirm>
          <Button type="primary" onClick={onEdit}>Sửa</Button>
        </Space>
      }>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space wrap>
          <Tag>{def.label}</Tag>
          {recipients.length ? recipients.map((r) => <Tag color="green" key={r}>→ {r}</Tag>) : <Tag>Chưa phân cho ai</Tag>}
        </Space>
        <Descriptions column={1} bordered size="middle">
          {item.data.fields.map((f) => (
            <Descriptions.Item key={f.key} label={f.label}>
              {f.secret && !revealed[f.key] ? (
                <Space>
                  <span className="secret-mask">••••••••</span>
                  <Button size="small" icon={<EyeOutlined />} onClick={() => setRevealed((r) => ({ ...r, [f.key]: true }))}>Hiện</Button>
                </Space>
              ) : (
                <Space align="start">
                  <span style={{ whiteSpace: 'pre-wrap' }}>{f.value}</span>
                  {f.secret && <Button size="small" icon={<EyeInvisibleOutlined />} onClick={() => setRevealed((r) => ({ ...r, [f.key]: false }))} />}
                </Space>
              )}
            </Descriptions.Item>
          ))}
          {item.data.todo && <Descriptions.Item label="Việc cần làm">{item.data.todo}</Descriptions.Item>}
          {item.data.notes && <Descriptions.Item label="Ghi chú"><span style={{ whiteSpace: 'pre-wrap' }}>{item.data.notes}</span></Descriptions.Item>}
        </Descriptions>
        {item.data.attachments?.map((a, i) => (
          <div key={i}>
            {a.type.startsWith('image/') && <Image src={`data:${a.type};base64,${a.dataB64}`} width={240} style={{ borderRadius: 8 }} />}
            <div>
              📎 {a.name} <span className="muted">({formatBytes(a.size)})</span>{' '}
              <Button type="link" size="small" onClick={() => download(a.name, a.type, a.dataB64)}>Tải về</Button>
            </div>
          </div>
        ))}
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          Cập nhật {formatDateTime(item.dto.lastModificationTime ?? item.dto.creationTime)} · {formatBytes(item.dto.sizeBytes)} đã mã hoá trên server
        </Typography.Text>
      </Space>
    </Drawer>
  );
}
