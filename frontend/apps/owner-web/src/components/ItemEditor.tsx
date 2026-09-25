/**
 * Thêm / sửa một hạng mục. Bước 1 chọn loại, bước 2 điền form riêng của loại đó.
 * Khi lưu: nội dung (kể cả tiêu đề, loại, tệp đính kèm) được MÃ HOÁ TRÊN MÁY rồi mới gửi lên server.
 * Sửa hạng mục giữ nguyên ItemKey để các grant đã phân bổ vẫn hợp lệ.
 */
import { useEffect, useState } from 'react';
import { App, Button, Card, Col, Drawer, Form, Input, Row, Space, Typography, Upload } from 'antd';
import { PaperClipOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { encryptItem, toBase64, type ItemAttachment, type VaultItemData, type VaultItemKind } from '@deathnote/crypto';
import { unwrap } from '@deathnote/api';
import { ErrorAlert, formatBytes } from '@deathnote/ui';
import { api } from '../config';
import { KINDS, kindDef } from '../lib/itemKinds';
import { qk } from '../lib/api-hooks';
import type { DecryptedItem } from '../lib/useDecryptedItems';
import { useVaultSession } from '../session/vaultSession';

const MAX_ATTACHMENT = 2 * 1024 * 1024;

export type ItemEditorProps = {
  open: boolean;
  onClose: () => void;
  /** Sửa hạng mục có sẵn; bỏ trống = thêm mới. */
  item?: DecryptedItem;
  /** Giới hạn danh sách loại (vd. trang Tài sản chỉ hiện loại "assets"). */
  section?: 'vault' | 'assets';
  /** Mở thẳng form của loại này (vd. từ câu hỏi "Bạn có sổ BHXH không?"). */
  presetKind?: VaultItemKind;
  presetTitle?: string;
};

export function ItemEditor({ open, onClose, item, section, presetKind, presetTitle }: ItemEditorProps) {
  const [kind, setKind] = useState<VaultItemKind | undefined>(item?.data.kind ?? presetKind);
  const [attachments, setAttachments] = useState<ItemAttachment[]>(item?.data.attachments ?? []);
  const [form] = Form.useForm();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const vaultKey = useVaultSession((s) => s.vaultKey);
  const qc = useQueryClient();
  const { message } = App.useApp();

  useEffect(() => {
    if (!open) return;
    setKind(item?.data.kind ?? presetKind);
    setAttachments(item?.data.attachments ?? []);
    setError(undefined);
    form.resetFields();
    if (item) {
      form.setFieldsValue({
        title: item.data.title,
        notes: item.data.notes,
        todo: item.data.todo,
        ...Object.fromEntries(item.data.fields.map((f) => [`f_${f.key}`, f.value])),
      });
    } else if (presetTitle) {
      form.setFieldsValue({ title: presetTitle });
    }
  }, [open, item, presetKind, presetTitle, form]);

  const def = kind ? kindDef(kind) : undefined;

  const save = async (values: Record<string, string>) => {
    if (!def || !vaultKey) return;
    setBusy(true);
    setError(undefined);
    try {
      const data: VaultItemData = {
        v: 1,
        kind: def.kind,
        title: values.title.trim(),
        fields: def.fields
          .map((f) => ({ key: f.key, label: f.label, value: (values[`f_${f.key}`] ?? '').trim(), secret: f.secret }))
          .filter((f) => f.value),
        notes: values.notes?.trim() || undefined,
        todo: values.todo?.trim() || undefined,
        attachments: attachments.length ? attachments : undefined,
        updatedAt: new Date().toISOString(),
      };
      // Mã hoá trên trình duyệt. Giữ ItemKey cũ khi sửa.
      const enc = await encryptItem(vaultKey, data, item?.itemKey);
      const body = { ciphertext: enc.ciphertext, wrappedItemKey: enc.wrappedItemKey };
      if (item) await unwrap(api.PUT('/api/app/vault/{id}/item', { params: { path: { id: item.id } }, body }));
      else await unwrap(api.POST('/api/app/vault/item', { body }));
      await qc.invalidateQueries({ queryKey: qk.items });
      await qc.invalidateQueries({ queryKey: qk.status });
      message.success('Đã mã hoá và lưu.');
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const addFile = async (file: File) => {
    if (file.size > MAX_ATTACHMENT) {
      message.error(`Tệp tối đa ${formatBytes(MAX_ATTACHMENT)} trong bản MVP.`);
      return false;
    }
    const dataB64 = toBase64(new Uint8Array(await file.arrayBuffer()));
    setAttachments((a) => [...a, { name: file.name, type: file.type || 'application/octet-stream', size: file.size, dataB64 }]);
    return false; // không upload trực tiếp — tệp được mã hoá cùng hạng mục
  };

  const kinds = KINDS.filter((k) => !section || k.section === section);

  return (
    <Drawer open={open} onClose={onClose} size="large" destroyOnHidden
      title={item ? `Sửa: ${item.data.title}` : def ? `Thêm ${def.label.toLowerCase()}` : 'Thêm hạng mục'}
      extra={def && <Button type="primary" loading={busy} onClick={() => form.submit()}>Mã hoá & lưu</Button>}>
      {!def ? (
        <>
          <Typography.Paragraph type="secondary">Chọn loại thông tin bạn muốn cất giữ:</Typography.Paragraph>
          <Row gutter={[12, 12]}>
            {kinds.map((k) => (
              <Col xs={24} sm={12} key={k.kind}>
                <Card hoverable onClick={() => setKind(k.kind)} styles={{ body: { padding: 16 } }}>
                  <Space align="start">
                    <span style={{ fontSize: 26 }}>{k.emoji}</span>
                    <div>
                      <b>{k.label}</b>
                      <div className="muted" style={{ fontSize: 13 }}>{k.description}</div>
                    </div>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </>
      ) : (
        <Form form={form} layout="vertical" onFinish={save} requiredMark={false}>
          {!item && (
            <Button type="link" style={{ padding: 0, marginBottom: 12 }} onClick={() => setKind(undefined)}>← Chọn loại khác</Button>
          )}
          <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Nhập tiêu đề' }]}>
            <Input placeholder={def.label} />
          </Form.Item>
          {def.fields.map((f) => (
            <Form.Item key={f.key} name={`f_${f.key}`} label={f.label}
              extra={f.secret ? 'Trường nhạy cảm — mặc định được che khi hiển thị.' : undefined}>
              {f.multiline ? <Input.TextArea rows={f.key === 'content' ? 10 : 3} placeholder={f.placeholder} />
                : f.secret ? <Input.Password placeholder={f.placeholder} autoComplete="off" />
                : <Input placeholder={f.placeholder} />}
            </Form.Item>
          ))}
          {def.section === 'assets' && (
            <Form.Item name="todo" label="Việc gia đình cần làm với mục này" extra={`Gợi ý: "${def.todoHint}…" — sẽ xuất hiện trong checklist của người nhận.`}>
              <Input />
            </Form.Item>
          )}
          <Form.Item name="notes" label="Ghi chú">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="Ảnh chụp / tệp đính kèm" extra="Tệp được mã hoá ngay trên máy trước khi tải lên (tối đa 2 MB/tệp).">
            <Upload beforeUpload={addFile} showUploadList={false} multiple>
              <Button icon={<PaperClipOutlined />}>Chọn tệp</Button>
            </Upload>
            {attachments.map((a, i) => (
              <div key={i} style={{ marginTop: 8 }}>
                📎 {a.name} <span className="muted">({formatBytes(a.size)})</span>{' '}
                <Button type="link" danger size="small" onClick={() => setAttachments((x) => x.filter((_, j) => j !== i))}>Bỏ</Button>
              </div>
            ))}
          </Form.Item>
          <ErrorAlert error={error} />
        </Form>
      )}
    </Drawer>
  );
}
