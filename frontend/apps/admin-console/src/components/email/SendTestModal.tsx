/** Gửi thử bản nháp hiện tại (chưa cần lưu) tới một địa chỉ email, dùng giá trị mẫu cho các biến. */
import { App, Form, Input, Modal, Typography } from 'antd';
import type { UpdateEmailTemplateInput } from '@deathnote/api';
import { errorMessage } from '@deathnote/ui';
import { useSendTestEmail } from '../../lib/api-hooks';

export function SendTestModal({ open, templateKey, draft, onClose }: {
  open: boolean;
  templateKey: string;
  draft: UpdateEmailTemplateInput;
  onClose: () => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm<{ to: string }>();
  const send = useSendTestEmail(templateKey);

  const submit = async () => {
    const { to } = await form.validateFields();
    try {
      await send.mutateAsync({ ...draft, to });
      message.success(`Đã gửi thư thử tới ${to}.`);
      onClose();
    } catch (e) {
      message.error(errorMessage(e));
    }
  };

  return (
    <Modal open={open} title="Gửi thử email" okText="Gửi" cancelText="Huỷ" onOk={() => void submit()} onCancel={onClose}
      confirmLoading={send.isPending} destroyOnHidden>
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        Gửi nội dung đang soạn (kể cả chưa lưu), các biến được thay bằng giá trị mẫu. Tiêu đề có tiền tố "[Thử]".
      </Typography.Paragraph>
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item name="to" label="Gửi tới" rules={[{ required: true, message: 'Nhập địa chỉ email' }, { type: 'email', message: 'Email không hợp lệ' }]}>
          <Input placeholder="ban@vidu.com" autoFocus />
        </Form.Item>
      </Form>
    </Modal>
  );
}
