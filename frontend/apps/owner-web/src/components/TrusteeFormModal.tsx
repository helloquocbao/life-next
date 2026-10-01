/**
 * Thêm / sửa người được uỷ quyền. Thêm mới KHÔNG gửi email ngay — mặc định họ không biết gì cho tới khi
 * owner thật sự bỏ lỡ xác nhận "vẫn ổn" (hoặc owner chủ động bấm "Gửi lời mời ngay" ở trang Người nhận).
 */
import { useEffect } from 'react';
import { App, Form, Input, Modal, Radio, Space } from 'antd';
import { TrusteeRole, type TrusteeDto } from '@deathnote/api';
import { ErrorAlert, trusteeRoleHint, trusteeRoleLabel } from '@deathnote/ui';
import { useSaveTrustee } from '../lib/api-hooks';

export function TrusteeFormModal({ open, trustee, onClose }: { open: boolean; trustee?: TrusteeDto; onClose: () => void }) {
  const [form] = Form.useForm();
  const save = useSaveTrustee();
  const { message } = App.useApp();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    save.reset();
    if (trustee) form.setFieldsValue(trustee);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trustee]);

  const submit = async (values: { displayName: string; email: string; phoneNumber?: string; relationship?: string; role: TrusteeRole }) => {
    await save.mutateAsync({ id: trustee?.id, body: values });
    message.success(trustee ? 'Đã cập nhật.' : 'Đã thêm. Chưa gửi lời mời — hệ thống sẽ tự gửi khi bạn bỏ lỡ xác nhận, hoặc bạn có thể gửi ngay ở trang Người nhận.');
    onClose();
  };

  return (
    <Modal open={open} onCancel={onClose} title={trustee ? 'Sửa người được uỷ quyền' : 'Thêm người được uỷ quyền'}
      okText={trustee ? 'Lưu' : 'Thêm'} onOk={() => form.submit()} confirmLoading={save.isPending} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={submit} requiredMark={false} initialValues={{ role: TrusteeRole.KeyHolder }}>
        <Form.Item name="displayName" label="Họ tên" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
        <Form.Item name="phoneNumber" label="Số điện thoại"><Input /></Form.Item>
        <Form.Item name="relationship" label="Quan hệ"><Input placeholder="Vợ/chồng, con, bạn thân, luật sư…" /></Form.Item>
        <Form.Item name="role" label="Vai trò">
          <Radio.Group>
            <Space direction="vertical">
              {[TrusteeRole.KeyHolder, TrusteeRole.Verifier, TrusteeRole.ContentOnly].map((r) => (
                <Radio key={r} value={r}><b>{trusteeRoleLabel[r]}</b><div className="muted" style={{ fontSize: 13 }}>{trusteeRoleHint[r]}</div></Radio>
              ))}
            </Space>
          </Radio.Group>
        </Form.Item>
        <ErrorAlert error={save.error} />
      </Form>
    </Modal>
  );
}
