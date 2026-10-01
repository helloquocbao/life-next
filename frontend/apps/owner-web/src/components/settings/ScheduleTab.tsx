import { useState } from 'react';
import { App, Button, Card, Checkbox, Form, Input, Radio, Slider, Space, Tag, Typography } from 'antd';
import { unwrap } from '@deathnote/api';
import { ErrorAlert } from '@deathnote/ui';
import { api } from '../../config';
import { useInvalidateOwner, useOwnerStatus } from '../../lib/api-hooks';

export function ScheduleTab() {
  const status = useOwnerStatus();
  const invalidate = useInvalidateOwner();
  const { message } = App.useApp();
  const [error, setError] = useState<unknown>();
  if (!status.data) return null;
  const s = status.data;

  const saveSchedule = async (v: { checkInIntervalDays: number; graceDays: number }) => {
    try {
      await unwrap(api.PUT('/api/app/owner/schedule', { body: v }));
      await invalidate();
      message.success('Đã lưu nhịp check-in.');
    } catch (e) { setError(e); }
  };
  const saveContact = async (v: { displayName: string; phoneNumber?: string }) => {
    try {
      await unwrap(api.PUT('/api/app/owner/contact', { body: v }));
      await invalidate();
      message.success('Đã lưu thông tin liên hệ.');
    } catch (e) { setError(e); }
  };
  const setStaffContact = async (enabled: boolean) => {
    try {
      await unwrap(api.POST('/api/app/owner/set-staff-contact-on-missed', { body: { enabled } }));
      await invalidate();
      message.success(enabled ? 'Đã bật.' : 'Đã tắt.');
    } catch (e) { setError(e); }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <ErrorAlert error={error} />
      <Card title="Nhịp check-in">
        <Form layout="vertical" onFinish={saveSchedule} initialValues={{ checkInIntervalDays: s.checkInIntervalDays, graceDays: s.graceDays }}>
          <Form.Item name="checkInIntervalDays" label="Bao lâu xác nhận một lần">
            <Radio.Group optionType="button" buttonStyle="solid" options={[7, 14, 30, 90].map((d) => ({ value: d, label: `${d} ngày` }))} />
          </Form.Item>
          <Form.Item name="graceDays" label="Thời gian ân hạn sau khi báo người thân (ngày)">
            <Slider min={7} max={30} marks={{ 7: '7', 14: '14', 21: '21', 30: '30' }} />
          </Form.Item>
          <Typography.Paragraph type="secondary">
            Kênh nhắc khi quá hạn: thông báo → email → SMS → gọi tự động. Mỗi tin nhắc đều có nút check-in một chạm.
          </Typography.Paragraph>
          <Button type="primary" htmlType="submit">Lưu</Button>
        </Form>
      </Card>
      <Card title="Nhân viên liên hệ khi đến hạn" extra={<Tag color="gold">Trả phí định kỳ</Tag>}>
        <Typography.Paragraph type="secondary">
          Khi bạn bỏ lỡ xác nhận "vẫn ổn", ngoài email/SMS tự động gửi cho người thân, nhân viên PICO sẽ
          chủ động gọi điện liên hệ thêm với bạn (và người thân nếu cần) để xác minh trước khi tiến trình
          tiếp tục leo thang.
        </Typography.Paragraph>
        <Checkbox checked={!!s.staffContactOnMissed} onChange={(e) => setStaffContact(e.target.checked)}>
          Bật nhân viên chủ động liên hệ khi đến hạn
        </Checkbox>
      </Card>
      <Card title="Thông tin liên hệ">
        <Form layout="vertical" onFinish={saveContact} initialValues={{ displayName: s.displayName, phoneNumber: s.phoneNumber }}>
          <Form.Item name="displayName" label="Tên hiển thị" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="phoneNumber" label="Số điện thoại (nhận SMS / cuộc gọi nhắc)"><Input /></Form.Item>
          <Form.Item label="Email"><Input value={s.email ?? ''} disabled /></Form.Item>
          <Button type="primary" htmlType="submit">Lưu</Button>
        </Form>
      </Card>
    </Space>
  );
}
