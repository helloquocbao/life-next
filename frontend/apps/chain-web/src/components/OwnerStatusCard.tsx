/** Trạng thái của A + thanh toán (thanh toán = check-in). */
import { useState } from 'react';
import { Alert, App, Button, Card, Descriptions, InputNumber, Space, Tag, Typography } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { config } from '../config';
import { useOwnerStatus, usePay } from '../lib/hooks';
import { useSession } from '../lib/session';
import { errorText, formatTime, remaining, sol } from '../lib/format';
import { useChainNow } from '../lib/hooks';

const phaseTag = {
  active: <Tag color="green">Đang hoạt động</Tag>,
  overdue: <Tag color="orange">Quá hạn thanh toán</Tag>,
  released: <Tag color="red">Đã tới hạn bàn giao</Tag>,
};

export function OwnerStatusCard() {
  const { message } = App.useApp();
  const { me } = useSession();
  const { profile, status } = useOwnerStatus(me);
  const now = useChainNow().data ?? 0;
  const pay = usePay();
  const [months, setMonths] = useState(1);

  const min = status?.minMonthsNow ?? 1;
  const max = profile ? status?.maxMonthsNow ?? 0 : 3;
  const value = Math.min(Math.max(months, min), Math.max(max, min));

  const doPay = async () => {
    try {
      await pay.mutateAsync(value);
      message.success(`Đã thanh toán ${value} tháng — đã check-in.`);
    } catch (e) {
      message.error(errorText(e));
    }
  };

  return (
    <Card title="Thanh toán & check-in" extra={status && phaseTag[status.phase]}>
      {!profile ? (
        <Typography.Paragraph>
          Bạn chưa có hồ sơ. Lần thanh toán đầu (hoặc tạo két đầu tiên) sẽ tạo hồ sơ và trả tháng đầu. <b>Mỗi lần thanh toán là một lần check-in</b> — quá hạn{' '}
          {config.demoTime ? '30 ngày (bản demo: 2 phút)' : '30 ngày'} mà chưa trả thì các két được bàn giao cho người nhận.
        </Typography.Paragraph>
      ) : (
        <Descriptions size="small" column={1} style={{ marginBottom: 12 }}
          items={[
            { key: 'paid', label: 'Đã trả tới', children: `${formatTime(profile.paidUntil)} (${now < profile.paidUntil ? `còn ${remaining(profile.paidUntil - now)}` : 'đã hết'})` },
            { key: 'release', label: 'Bàn giao nếu không trả tiếp', children: `${formatTime(status!.releaseAt)} (${remaining(status!.releaseAt - now)})` },
          ]} />
      )}
      {status?.phase === 'released' && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }}
          title="Đã tới hạn bàn giao. Két nào người nhận chưa lấy sẽ được giữ lại nếu bạn thanh toán ngay." />
      )}
      {max === 0 ? (
        <Typography.Text type="secondary">Bạn đã trả trước tối đa 90 ngày.</Typography.Text>
      ) : (
        <Space wrap>
          <InputNumber min={min} max={max} value={value} onChange={(v) => setMonths(v ?? 1)} suffix="tháng" style={{ width: 130 }} />
          <Button type="primary" icon={<CheckCircleOutlined />} loading={pay.isPending} onClick={() => void doPay()}>
            Thanh toán {sol(value * config.monthlyPriceLamports)}
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Trả trước tối đa 90 ngày (khi biết trước sẽ vắng).</Typography.Text>
        </Space>
      )}
    </Card>
  );
}
