/**
 * Chi tiết từng hạng mục đã giải mã: tiêu đề, các trường (trường bí mật mặc định che — bấm để hiện),
 * ghi chú, tệp đính kèm (ảnh xem trước; tải file từ dữ liệu base64 đã giải mã).
 *
 * Khi in (Xuất PDF), mọi giá trị bí mật được hiện đầy đủ (lớp .print-only) để làm việc với ngân hàng/luật sư.
 */
import { useState } from 'react';
import { Button, Card, Image, Tag, Typography } from 'antd';
import { DownloadOutlined, EyeInvisibleOutlined, EyeOutlined, PaperClipOutlined } from '@ant-design/icons';
import { fromBase64, type ItemAttachment, type ItemField, type VaultItemData } from '@deathnote/crypto';
import { formatBytes } from '@deathnote/ui';
import type { OpenedItem } from '../../session/inboxSession';
import { itemKindLabel, kindDisplayOrder } from '../../lib/checklist';

export function ItemDetails({ items }: { items: OpenedItem[] }) {
  // Sắp theo nhóm loại giống Bản đồ tài sản; mục lỗi xuống cuối.
  const order = (i: OpenedItem) => (i.data ? kindDisplayOrder.indexOf(i.data.kind) : 99);
  const sorted = [...items].sort((a, b) => order(a) - order(b));

  return (
    <>
      <Typography.Title level={4}>Chi tiết hạng mục</Typography.Title>
      {sorted.map((i) =>
        i.data ? <ItemCard key={i.id} data={i.data} /> : (
          <Card key={i.id} size="small" style={{ marginBottom: 16 }}>
            <Typography.Text type="secondary">{i.error}</Typography.Text>
          </Card>
        ),
      )}
    </>
  );
}

function ItemCard({ data }: { data: VaultItemData }) {
  return (
    <Card style={{ marginBottom: 16 }} title={<span style={{ whiteSpace: 'normal' }}>{data.title}</span>}
      extra={<Tag>{itemKindLabel[data.kind] ?? data.kind}</Tag>}>
      {data.fields.map((f) => <FieldRow key={f.key} field={f} />)}
      {data.todo && (
        <Typography.Paragraph style={{ marginTop: 12 }}><strong>Việc cần làm:</strong> {data.todo}</Typography.Paragraph>
      )}
      {data.notes && (
        <Typography.Paragraph style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>
          <strong>Ghi chú:</strong> {data.notes}
        </Typography.Paragraph>
      )}
      {data.attachments && data.attachments.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {data.attachments.map((att, idx) => <AttachmentView key={`${att.name}-${idx}`} att={att} />)}
        </div>
      )}
    </Card>
  );
}

function FieldRow({ field }: { field: ItemField }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="field-row">
      <Typography.Text type="secondary">{field.label}</Typography.Text>
      <div className="field-value">
        {field.secret ? (
          <>
            <span className="screen-only">
              {shown ? <Typography.Text copyable>{field.value}</Typography.Text> : <span className="secret-mask">••••••••</span>}
              <Button type="link" size="small" icon={shown ? <EyeInvisibleOutlined /> : <EyeOutlined />} onClick={() => setShown((s) => !s)}>
                {shown ? 'Ẩn' : 'Hiện'}
              </Button>
            </span>
            {/* Bản in luôn hiện đầy đủ giá trị. */}
            <span className="print-only">{field.value}</span>
          </>
        ) : (
          <Typography.Text copyable={!!field.value}>{field.value || '—'}</Typography.Text>
        )}
      </div>
    </div>
  );
}

/** Tải tệp đính kèm: dựng Blob từ base64 đã giải mã → URL tạm → tải về, rồi thu hồi URL. */
function download(att: ItemAttachment) {
  const bytes = fromBase64(att.dataB64);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: att.type || 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = att.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function AttachmentView({ att }: { att: ItemAttachment }) {
  const isImage = att.type?.startsWith('image/');
  return (
    <div style={{ marginBottom: 12 }}>
      {isImage && (
        <Image src={`data:${att.type};base64,${att.dataB64}`} alt={att.name} style={{ maxHeight: 240, borderRadius: 8 }} />
      )}
      <div>
        <PaperClipOutlined /> {att.name} <span className="muted">({formatBytes(att.size)})</span>
        <Button type="link" size="small" icon={<DownloadOutlined />} className="no-print" onClick={() => download(att)}>Tải về</Button>
      </div>
    </div>
  );
}
