/**
 * Tạo / sửa két: tên két, ví người nhận, các mục thông tin (chữ) và tệp tài liệu. Mọi thứ được mã hoá
 * ngay trên trình duyệt trước khi tải lên.
 */
import { useState } from 'react';
import { App, Button, Checkbox, Form, Input, List, Modal, Space, Typography, Upload } from 'antd';
import { DeleteOutlined, MinusCircleOutlined, PaperClipOutlined, PlusOutlined } from '@ant-design/icons';
import { PublicKey } from '@solana/web3.js';
import { toBase64 } from '@deathnote/crypto';
import { MAX_VAULT_FILES_BYTES, type VaultAccount, type VaultContent, type VaultFile } from '@deathnote/chain';
import { useSaveVault } from '../lib/hooks';
import { useSession } from '../lib/session';
import { errorText } from '../lib/format';

type FormValues = { title: string; heir: string; note?: string; entries: { label: string; value: string; secret?: boolean }[] };

export function VaultEditor({ existing, onClose }: {
  existing?: { vault: VaultAccount; vaultKey: Uint8Array; content: VaultContent };
  onClose: () => void;
}) {
  const { message } = App.useApp();
  const { me } = useSession();
  const [form] = Form.useForm<FormValues>();
  const [files, setFiles] = useState<VaultFile[]>(existing?.content.files ?? []);
  const save = useSaveVault();
  const totalBytes = files.reduce((n, f) => n + f.size, 0);

  const addFile = async (file: File) => {
    if (totalBytes + file.size > MAX_VAULT_FILES_BYTES) {
      message.error('Tổng tệp của một két tối đa 5 MB.');
      return false;
    }
    const dataB64 = toBase64(new Uint8Array(await file.arrayBuffer()));
    setFiles((fs) => [...fs, { name: file.name, type: file.type, size: file.size, dataB64 }]);
    return false; // không tải lên thẳng — tệp được mã hoá cùng két
  };

  const submit = async (v: FormValues) => {
    try {
      await save.mutateAsync({
        existing: existing && { vault: existing.vault, vaultKey: existing.vaultKey },
        heir: v.heir.trim(),
        content: { v: 1, title: v.title.trim(), note: v.note?.trim() || undefined, entries: v.entries ?? [], files, updatedAt: new Date().toISOString() },
      });
      message.success(existing ? 'Đã lưu két.' : 'Đã tạo két.');
      onClose();
    } catch (e) {
      message.error(errorText(e));
    }
  };

  return (
    <Modal open width={640} title={existing ? 'Sửa két' : 'Tạo két mới'} okText={existing ? 'Mã hoá & lưu' : 'Mã hoá & tạo'}
      cancelText="Huỷ" onOk={() => form.submit()} onCancel={onClose} confirmLoading={save.isPending} destroyOnHidden>
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        Nội dung được mã hoá trên máy bạn. Người nhận chỉ mở được khi bạn quá hạn thanh toán 30 ngày.
      </Typography.Paragraph>
      <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}
        initialValues={existing
          ? { title: existing.content.title, heir: existing.vault.heir.toBase58(), note: existing.content.note, entries: existing.content.entries }
          : { entries: [{ label: '', value: '' }] }}>
        <Form.Item name="title" label="Tên két" rules={[{ required: true, message: 'Đặt tên cho két' }]}>
          <Input placeholder="vd. Cho con gái" maxLength={80} />
        </Form.Item>
        <Form.Item name="heir" label="Ví Solana của người nhận"
          rules={[{
            validator: async (_, v: string) => {
              let key: PublicKey;
              try { key = new PublicKey((v ?? '').trim()); } catch { throw new Error('Địa chỉ ví không hợp lệ'); }
              if (key.equals(me)) throw new Error('Người nhận phải là ví khác ví của bạn');
            },
          }]}>
          <Input placeholder="Địa chỉ ví (base58)" />
        </Form.Item>
        <Form.Item label="Thông tin">
          <Form.List name="entries">
            {(fields, { add, remove }) => (
              <>
                {fields.map((f) => (
                  <Space key={f.key} align="start" style={{ display: 'flex', marginBottom: 4 }}>
                    <Form.Item name={[f.name, 'label']} rules={[{ required: true, message: 'Tên mục' }]} style={{ marginBottom: 0 }}>
                      <Input placeholder="vd. Email" style={{ width: 150 }} />
                    </Form.Item>
                    <Form.Item name={[f.name, 'value']} rules={[{ required: true, message: 'Nội dung' }]} style={{ marginBottom: 0 }}>
                      <Input placeholder="Nội dung" style={{ width: 260 }} />
                    </Form.Item>
                    <Form.Item name={[f.name, 'secret']} valuePropName="checked" style={{ marginBottom: 0 }}>
                      <Checkbox>Bí mật</Checkbox>
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(f.name)} style={{ marginTop: 9 }} aria-label="Xoá mục" />
                  </Space>
                ))}
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ label: '', value: '' })}>Thêm mục</Button>
              </>
            )}
          </Form.List>
        </Form.Item>
        <Form.Item name="note" label="Lời nhắn (tuỳ chọn)">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item label={`Tệp tài liệu (${(totalBytes / 1024 / 1024).toFixed(2)} / 5 MB)`}>
          <Upload beforeUpload={addFile} showUploadList={false} multiple>
            <Button icon={<PaperClipOutlined />}>Thêm tệp</Button>
          </Upload>
          {files.length > 0 && (
            <List size="small" style={{ marginTop: 8 }} dataSource={files}
              renderItem={(f, i) => (
                <List.Item actions={[<Button key="x" type="text" size="small" icon={<DeleteOutlined />} aria-label="Bỏ tệp"
                  onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))} />]}>
                  {f.name} <Typography.Text type="secondary">({Math.ceil(f.size / 1024)} KB)</Typography.Text>
                </List.Item>
              )} />
          )}
        </Form.Item>
      </Form>
    </Modal>
  );
}
