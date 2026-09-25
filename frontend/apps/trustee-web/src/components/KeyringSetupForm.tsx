/**
 * Tạo khoá cá nhân của trustee.
 *
 * Mật mã: trình duyệt sinh cặp khoá X25519; khoá riêng được mã hoá bằng khoá dẫn xuất từ passphrase
 * (Argon2id) trước khi gửi lên. Server/PICO chỉ giữ bản đã mã hoá + khoá công khai ⇒ KHÔNG THỂ khôi phục
 * passphrase. Owner dùng khoá công khai này để niêm phong mảnh khoá Shamir và phần nội dung dành cho bạn.
 */
import { useState } from 'react';
import { App, Alert, Button, Checkbox, Form, Input, Typography } from 'antd';
import { createKeyring, wipe } from '@deathnote/crypto';
import { ErrorAlert } from '@deathnote/ui';
import { MIN_PASSPHRASE_LENGTH } from '../config';
import { useCreateKeyring } from '../lib/api-hooks';

type Values = { passphrase: string; confirm: string; wroteDown: boolean };

export function KeyringSetupForm({ onDone, submitText = 'Tạo khoá cá nhân' }: { onDone: () => void | Promise<void>; submitText?: string }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const save = useCreateKeyring();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();

  const finish = async (v: Values) => {
    setBusy(true);
    setError(undefined);
    try {
      // 1) Sinh cặp khoá + bọc khoá riêng bằng passphrase — hoàn toàn trên trình duyệt.
      const { payload, keys } = await createKeyring(v.passphrase);
      // 2) Khoá riêng dạng rõ không cần nữa → xoá khỏi bộ nhớ ngay.
      wipe(keys.privateKey);
      // 3) Chỉ gửi khoá công khai + khoá riêng đã mã hoá + tham số KDF.
      await save.mutateAsync(payload);
      form.resetFields();
      message.success('Đã tạo khoá cá nhân.');
      await onDone();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Typography.Title level={3} style={{ marginTop: 0 }}>Tạo khoá cá nhân</Typography.Title>
      <Typography.Paragraph>
        Passphrase này dùng để mở phần thông tin được giao cho bạn khi đến lúc cần. Hãy chọn một câu dài,
        dễ nhớ với bạn — ví dụ một câu nói quen thuộc trong gia đình.
      </Typography.Paragraph>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 24 }}
        title="PICO không thể khôi phục passphrase này"
        description="Chúng tôi không lưu và không đọc được passphrase của bạn. Nếu quên, bạn sẽ không mở được phần được giao. Hãy ghi ra giấy và cất cùng giấy tờ quan trọng."
      />
      <Form form={form} layout="vertical" onFinish={finish} requiredMark={false} disabled={busy}>
        <Form.Item name="passphrase" label="Passphrase (tối thiểu 10 ký tự)"
          rules={[{ required: true, message: 'Vui lòng nhập passphrase.' },
            { min: MIN_PASSPHRASE_LENGTH, message: `Passphrase cần ít nhất ${MIN_PASSPHRASE_LENGTH} ký tự.` }]}>
          <Input.Password size="large" autoComplete="new-password" />
        </Form.Item>
        <Form.Item name="confirm" label="Nhập lại passphrase" dependencies={['passphrase']}
          rules={[{ required: true, message: 'Vui lòng nhập lại passphrase.' },
            ({ getFieldValue }) => ({
              validator: (_, value: string) =>
                !value || value === getFieldValue('passphrase') ? Promise.resolve() : Promise.reject(new Error('Hai lần nhập không khớp.')),
            })]}>
          <Input.Password size="large" autoComplete="new-password" />
        </Form.Item>
        <Form.Item name="wroteDown" valuePropName="checked"
          rules={[{ validator: (_, v: boolean) => (v ? Promise.resolve() : Promise.reject(new Error('Vui lòng xác nhận trước khi tiếp tục.'))) }]}>
          <Checkbox>Tôi đã ghi passphrase ra giấy và hiểu rằng PICO không khôi phục được.</Checkbox>
        </Form.Item>
        <ErrorAlert error={error} style={{ marginBottom: 16 }} />
        <Button type="primary" htmlType="submit" size="large" block loading={busy}>{submitText}</Button>
        {busy && <Typography.Paragraph type="secondary" style={{ marginTop: 12, textAlign: 'center' }}>
          Đang tạo khoá an toàn trên máy của bạn — có thể mất vài giây…
        </Typography.Paragraph>}
      </Form>
    </>
  );
}
