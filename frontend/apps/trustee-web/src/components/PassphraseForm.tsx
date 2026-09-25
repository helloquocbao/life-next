/**
 * Ô nhập passphrase để mở khoá cá nhân — dùng ở hộp nhận và khi đồng thuận.
 *
 * Passphrase không bao giờ rời trình duyệt: nó chỉ dùng để dẫn xuất khoá (Argon2id) mở khoá riêng.
 * Việc dẫn xuất cố ý chậm (vài giây) để chống dò mật khẩu — hiển thị tiến trình cho người dùng yên tâm.
 */
import { useState } from 'react';
import { Button, Form, Input, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { ErrorAlert } from '@deathnote/ui';

type Props = {
  submitText: string;
  /** Trả về Promise; ném lỗi để hiển thị ngay dưới form. */
  onSubmit: (passphrase: string, setProgress: (s: string) => void) => Promise<void>;
  hint?: string;
};

export function PassphraseForm({ submitText, onSubmit, hint }: Props) {
  const [form] = Form.useForm<{ passphrase: string }>();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>();
  const [error, setError] = useState<unknown>();

  const finish = async ({ passphrase }: { passphrase: string }) => {
    setBusy(true);
    setError(undefined);
    try {
      await onSubmit(passphrase, setProgress);
      form.resetFields(); // không giữ passphrase trong state của form sau khi dùng xong
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      setProgress(undefined);
    }
  };

  return (
    <Form form={form} layout="vertical" onFinish={finish} requiredMark={false} disabled={busy}>
      <Form.Item name="passphrase" label="Passphrase khoá cá nhân" rules={[{ required: true, message: 'Vui lòng nhập passphrase.' }]}
        extra={hint}>
        <Input.Password prefix={<LockOutlined />} size="large" autoFocus autoComplete="current-password" />
      </Form.Item>
      <ErrorAlert error={error} style={{ marginBottom: 16 }} />
      <Button type="primary" htmlType="submit" size="large" block loading={busy}>{submitText}</Button>
      {progress && <Typography.Paragraph type="secondary" style={{ marginTop: 12, textAlign: 'center' }}>{progress}</Typography.Paragraph>}
    </Form>
  );
}
