/**
 * Nút "Tôi vẫn ổn" — chạm một lần là xong. Nếu owner bật 2FA, hỏi thêm mã 6 số.
 * Trong mọi giai đoạn cảnh báo, đây cũng chính là nút PHỦ QUYẾT (huỷ toàn bộ tiến trình).
 */
import { useState } from 'react';
import { App, Button, Input, Modal, type ButtonProps } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import { ErrorAlert } from '@deathnote/ui';
import { useCheckIn } from '../lib/api-hooks';

export function CheckInButton({ twoFactor, label = 'Tôi vẫn ổn', danger, ...rest }: { twoFactor: boolean; label?: string } & ButtonProps) {
  const checkIn = useCheckIn();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');

  const run = async (c?: string) => {
    const res = await checkIn.mutateAsync(c);
    setOpen(false);
    setCode('');
    message.success(res.wasVeto ? 'Đã huỷ toàn bộ tiến trình. Người thân của bạn đã được thông báo.' : 'Đã ghi nhận — bạn đang ổn.');
  };

  return (
    <>
      <Button type="primary" danger={danger} size="large" icon={<CheckCircleFilled />} loading={checkIn.isPending && !open}
        style={{ height: 56, paddingInline: 32, fontSize: 18, borderRadius: 28 }}
        onClick={() => (twoFactor ? setOpen(true) : run().catch(() => undefined))} {...rest}>
        {label}
      </Button>
      {!open && <ErrorAlert error={checkIn.error} style={{ marginTop: 12 }} />}
      <Modal open={open} title="Xác thực hai lớp" onCancel={() => setOpen(false)} okText="Xác nhận"
        onOk={() => run(code).catch(() => undefined)} confirmLoading={checkIn.isPending} destroyOnHidden>
        <p>Nhập mã 6 số từ ứng dụng xác thực của bạn.</p>
        <Input.OTP length={6} value={code} onChange={setCode} autoFocus />
        <ErrorAlert error={checkIn.error} style={{ marginTop: 12 }} />
      </Modal>
    </>
  );
}
