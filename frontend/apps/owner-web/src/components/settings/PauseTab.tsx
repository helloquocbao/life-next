import { useState } from 'react';
import { App, Alert, Button, Card, DatePicker, Form, Input, Space, Typography } from 'antd';
import { unwrap } from '@deathnote/api';
import { ErrorAlert, dayjs, formatDateTime } from '@deathnote/ui';
import { api } from '../../config';
import { useInvalidateOwner, useOwnerStatus } from '../../lib/api-hooks';

export function PauseTab() {
  const status = useOwnerStatus();
  const invalidate = useInvalidateOwner();
  const { message } = App.useApp();
  const [error, setError] = useState<unknown>();
  const paused = status.data?.pausedUntil;

  const pause = async (v: { until: dayjs.Dayjs; reason?: string }) => {
    try {
      await unwrap(api.POST('/api/app/owner/pause', { body: { until: v.until.toISOString(), reason: v.reason } }));
      await invalidate();
      message.success('Đã bật chế độ tạm dừng.');
    } catch (e) { setError(e); }
  };
  const resume = async () => {
    await unwrap(api.POST('/api/app/owner/resume'));
    await invalidate();
    message.success('Đã tắt chế độ tạm dừng.');
  };

  return (
    <Card title="Chế độ tạm dừng có thời hạn">
      <Typography.Paragraph type="secondary">
        Đặt trước khi đi nước ngoài hoặc nhập viện: đếm ngược check-in được dời tới sau ngày bạn trở về. Chế độ tự hết hạn,
        không dùng được vô thời hạn (tối đa 60 ngày).
      </Typography.Paragraph>
      {paused ? (
        <Space direction="vertical">
          <Alert type="info" showIcon title={`Đang tạm dừng tới ${formatDateTime(paused)}${status.data?.pauseReason ? ` — ${status.data.pauseReason}` : ''}`} />
          <Button onClick={resume}>Tắt tạm dừng</Button>
        </Space>
      ) : (
        <Form layout="vertical" onFinish={pause} style={{ maxWidth: 420 }}>
          <Form.Item name="until" label="Tạm dừng đến" rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: '100%' }} disabledDate={(d) => d.isBefore(dayjs())} />
          </Form.Item>
          <Form.Item name="reason" label="Lý do"><Input placeholder="Du lịch, công tác, nhập viện…" /></Form.Item>
          <ErrorAlert error={error} style={{ marginBottom: 12 }} />
          <Button type="primary" htmlType="submit">Bật tạm dừng</Button>
        </Form>
      )}
    </Card>
  );
}
