/**
 * Nút "Tôi vẫn ổn" — chạm một lần là xong, không cần bước xác thực nào thêm (kể cả khi 2FA đã bật —
 * 2FA chỉ áp dụng ở bước mở két, xem UnlockGate, vì check-in cần nhanh và có thể tới từ link email/SMS
 * không đăng nhập được).
 * Trong mọi giai đoạn cảnh báo, đây cũng chính là nút PHỦ QUYẾT (huỷ toàn bộ tiến trình).
 */
import { App, Button, type ButtonProps } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import { ErrorAlert } from '@deathnote/ui';
import { useCheckIn } from '../lib/api-hooks';

export function CheckInButton({ label = 'Tôi vẫn ổn', danger, ...rest }: { label?: string } & ButtonProps) {
  const checkIn = useCheckIn();
  const { message } = App.useApp();

  const run = async () => {
    const res = await checkIn.mutateAsync();
    message.success(res.wasVeto ? 'Đã huỷ toàn bộ tiến trình. Người thân của bạn đã được thông báo.' : 'Đã ghi nhận — bạn đang ổn.');
  };

  return (
    <>
      <Button type="primary" danger={danger} size="large" icon={<CheckCircleFilled />} loading={checkIn.isPending}
        style={{ height: 56, paddingInline: 32, fontSize: 18, borderRadius: 28 }}
        onClick={() => run().catch(() => undefined)} {...rest}>
        {label}
      </Button>
      <ErrorAlert error={checkIn.error} style={{ marginTop: 12 }} />
    </>
  );
}
