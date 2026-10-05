/**
 * Thêm / sửa người được giao vai trò. Hai vai trò theo đúng trình tự xảy ra khi bạn ngừng bấm "Tôi vẫn ổn":
 *   1) Người nhắc nhở — được báo trước, nhiệm vụ nhắc bạn bấm nút.
 *   2) Người nhận thông tin — hết thời gian ân hạn mà bạn vẫn không bấm thì tự động nhận phần bạn cho phép.
 *
 * Thêm mới KHÔNG gửi email ngay. Người nhắc nhở được mời tự động khi bạn thật sự bỏ lỡ xác nhận. Người nhận thông tin
 * thì THỤ ĐỘNG: không mời, không báo gì trước — họ chỉ nhận email (kèm link xem) khi bạn gặp sự cố.
 */
import { useEffect } from 'react';
import { App, Form, Input, Modal, Radio } from 'antd';
import { BellOutlined, GiftOutlined } from '@ant-design/icons';
import { TrusteeRole, type TrusteeDto } from '@deathnote/api';
import { ErrorAlert, colors, trusteeRoleHint, trusteeRoleLabel } from '@deathnote/ui';
import { useOwnerStatus, useSaveTrustee } from '../lib/api-hooks';

/** Thứ tự = thứ tự xảy ra trong thực tế. */
const ROLES = [
  { role: TrusteeRole.Reminder, icon: <BellOutlined />, step: 'Bước 1' },
  { role: TrusteeRole.Recipient, icon: <GiftOutlined />, step: 'Bước 2' },
] as const;

export function TrusteeFormModal({ open, trustee, defaultRole, onClose }: {
  open: boolean; trustee?: TrusteeDto; defaultRole?: TrusteeRole; onClose: () => void;
}) {
  const [form] = Form.useForm();
  const save = useSaveTrustee();
  const status = useOwnerStatus();
  const { message } = App.useApp();
  const graceDays = status.data?.graceDays;
  const role = Form.useWatch('role', form) as TrusteeRole | undefined;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    save.reset();
    if (trustee) form.setFieldsValue(trustee);
    else form.setFieldsValue({ role: defaultRole ?? TrusteeRole.Reminder });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trustee, defaultRole]);

  const submit = async (values: { displayName: string; email: string; phoneNumber?: string; relationship?: string; role: TrusteeRole }) => {
    await save.mutateAsync({ id: trustee?.id, body: values });
    message.success(
      trustee ? 'Đã cập nhật.'
        : values.role === TrusteeRole.Recipient
          ? 'Đã thêm. Họ không biết gì và không nhận email nào — chỉ được báo khi bạn gặp sự cố. Nhớ chọn thông tin cho họ.'
          : 'Đã thêm. Họ chưa biết gì — hệ thống sẽ tự mời khi bạn bỏ lỡ xác nhận.',
    );
    onClose();
  };

  return (
    <Modal open={open} onCancel={onClose} title={trustee ? 'Sửa người được giao vai trò' : 'Thêm người được giao vai trò'}
      okText={trustee ? 'Lưu' : 'Thêm'} onOk={() => form.submit()} confirmLoading={save.isPending} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={submit} requiredMark={false} initialValues={{ role: TrusteeRole.Reminder }}>
        <Form.Item name="displayName" label="Họ tên" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
        <Form.Item name="phoneNumber" label="Số điện thoại" extra="Dùng để báo tin khi cần."><Input /></Form.Item>
        <Form.Item name="relationship" label="Quan hệ"><Input placeholder="Vợ/chồng, con, bạn thân, luật sư…" /></Form.Item>

        <Form.Item name="role" label="Người này sẽ làm gì?">
          <Radio.Group style={{ width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ROLES.map(({ role: r, icon, step }) => (
                <Radio key={r} value={r} className="role-option">
                  <span className="role-option-body">
                    <span className="role-option-icon" style={{ color: colors.primary }}>{icon}</span>
                    <span>
                      <span className="role-option-step">{step}</span>
                      <b className="role-option-title">{trusteeRoleLabel[r]}</b>
                      <span className="muted role-option-hint">{trusteeRoleHint[r]}</span>
                    </span>
                  </span>
                </Radio>
              ))}
            </div>
          </Radio.Group>
        </Form.Item>

        <div className="role-timeline muted">
          <b>Cách hoạt động:</b> bạn ngừng bấm "Tôi vẫn ổn" → hệ thống nhắc bạn → <b>người nhắc nhở</b> được báo
          {graceDays ? <> và có <b>{graceDays} ngày</b> để liên lạc với bạn</> : ' và có vài ngày để liên lạc với bạn'} → nếu bạn vẫn không bấm,{' '}
          <b>người nhận thông tin</b> mới nhận email kèm link để xem phần bạn đã chọn. Trước đó họ hoàn toàn không biết gì. Bạn bấm "Tôi vẫn ổn" ở bất kỳ lúc nào trước đó là mọi thứ dừng lại.
          {role === TrusteeRole.Recipient && ' Người nhận không cần tạo tài khoản hay làm gì trước.'}
        </div>
        <ErrorAlert error={save.error} style={{ marginTop: 12 }} />
      </Form>
    </Modal>
  );
}
