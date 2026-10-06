/**
 * CHÍNH SÁCH VÒNG ĐỜI — các tham số quyết định khi nào hồ sơ chuyển trạng thái và tự động bàn giao.
 *
 * - Ai có quyền `DeathNote.Policy` được xem; có thêm `DeathNote.Policy.Manage` thì sửa và lưu trực tiếp
 *   (có hiệu lực ngay, không cần duyệt). Mỗi lần lưu được ghi vào audit log kèm giá trị cũ → mới.
 * - Nhịp check-in cho phép và hệ số nén thời gian là cấu hình triển khai → chỉ xem.
 */
import { useState, type ReactNode } from 'react';
import { App, Button, Card, Checkbox, Descriptions, Form, InputNumber, Skeleton, Space, Tag, Typography } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import type { PolicyDto, UpdatePolicyInput } from '@deathnote/api';
import { ErrorAlert, errorMessage, humanizeBusiness } from '@deathnote/ui';
import { usePolicy, useProfile, useUpdatePolicy } from '../lib/api-hooks';
import { hasPerm, Perm } from '../lib/permissions';
import { PageTitle } from '../components/PageTitle';

function Item({ value, hint }: { value: ReactNode; hint: string }) {
  return (
    <div>
      <Typography.Text strong>{value}</Typography.Text>
      <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{hint}</Typography.Text></div>
    </div>
  );
}

const days = (name: keyof UpdatePolicyInput, label?: string) => (
  <Form.Item name={name} label={label} rules={[{ required: true, message: 'Bắt buộc' }]} style={{ marginBottom: 0 }}>
    <InputNumber min={1} max={365} suffix="ngày" style={{ width: 150 }} />
  </Form.Item>
);

const HINT = {
  missed: 'Thời gian hệ thống liên tục nhắc owner trước khi báo cho người nhắc nhở (Grace).',
  channels: 'Các kênh dùng để nhắc owner check-in ở giai đoạn Missed — mỗi kênh là một vòng nhắc.',
  grace: 'Người nhắc nhở được báo; hết thời gian này mà owner vẫn không check-in thì thông tin tự động bàn giao cho người nhận.',
  pause: 'Owner có thể tạm dừng đếm giờ (đi xa, nằm viện có kế hoạch) tối đa chừng này ngày.',
};

export function PolicyPage() {
  const { data: p, isLoading, error } = usePolicy(true);
  const { data: profile } = useProfile();
  const canManage = hasPerm(profile, Perm.PolicyManage);
  const [editing, setEditing] = useState(false);

  return (
    <>
      <PageTitle title="Chính sách vòng đời"
        subtitle={canManage ? 'Tham số đang áp dụng cho toàn hệ thống — sửa và lưu là có hiệu lực ngay.' : 'Tham số đang áp dụng cho toàn hệ thống (chỉ xem).'} />
      <ErrorAlert error={error} style={{ marginBottom: 12 }} />
      {isLoading ? <Skeleton active /> : p && (
        <Card size="small"
          extra={canManage && !editing && <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>Chỉnh sửa</Button>}>
          {editing ? <PolicyForm policy={p} onDone={() => setEditing(false)} /> : <PolicyView policy={p} />}
        </Card>
      )}
    </>
  );
}

function PolicyView({ policy: p }: { policy: PolicyDto }) {
  return (
    <Descriptions size="small" bordered column={1} styles={{ label: { width: 260 } }}
      items={[
        intervalsRow(p),
        { key: 'missed', label: 'Giai đoạn quá hạn (Missed)', children: <Item value={`${p.missedPhaseDays ?? 0} ngày`} hint={HINT.missed} /> },
        {
          key: 'channels', label: 'Kênh nhắc nhở',
          children: <Item value={<Space size={4} wrap>{(p.reminderChannels ?? []).map((c) => <Tag key={c}>{c}</Tag>)}</Space>} hint={HINT.channels} />,
        },
        {
          key: 'grace', label: 'Thời gian ân hạn (Grace)',
          children: <Item value={`Mặc định ${p.defaultGraceDays ?? 0} ngày (owner chọn ${p.minGraceDays ?? 0}–${p.maxGraceDays ?? 0} ngày)`} hint={HINT.grace} />,
        },
        { key: 'pause', label: 'Tạm dừng tối đa', children: <Item value={`${p.maxPauseDays ?? 0} ngày`} hint={HINT.pause} /> },
        timeScaleRow(p),
      ]} />
  );
}

function PolicyForm({ policy: p, onDone }: { policy: PolicyDto; onDone: () => void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<UpdatePolicyInput>();
  const save = useUpdatePolicy();

  const submit = async (values: UpdatePolicyInput) => {
    try {
      await save.mutateAsync(values);
      message.success('Đã lưu chính sách — có hiệu lực ngay.');
      onDone();
    } catch (e) {
      message.error(errorMessage(e));
    }
  };

  return (
    <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}
      initialValues={{
        missedPhaseDays: p.missedPhaseDays, reminderChannels: p.reminderChannels, defaultGraceDays: p.defaultGraceDays,
        minGraceDays: p.minGraceDays, maxGraceDays: p.maxGraceDays, maxPauseDays: p.maxPauseDays,
      }}>
      <Descriptions size="small" bordered column={1} styles={{ label: { width: 260 } }}
        items={[
          intervalsRow(p),
          { key: 'missed', label: 'Giai đoạn quá hạn (Missed)', children: <Hinted hint={HINT.missed}>{days('missedPhaseDays')}</Hinted> },
          {
            key: 'channels', label: 'Kênh nhắc nhở',
            children: (
              <Hinted hint={HINT.channels}>
                <Form.Item name="reminderChannels" rules={[{ required: true, type: 'array', min: 1, message: 'Chọn ít nhất một kênh' }]} style={{ marginBottom: 0 }}>
                  <Checkbox.Group options={(p.availableReminderChannels ?? []).map((c) => ({ label: c, value: c }))} />
                </Form.Item>
              </Hinted>
            ),
          },
          {
            key: 'grace', label: 'Thời gian ân hạn (Grace)',
            children: (
              <Hinted hint={HINT.grace}>
                <Space size={12} wrap align="start">
                  {days('minGraceDays', 'Tối thiểu')}
                  {days('defaultGraceDays', 'Mặc định')}
                  {days('maxGraceDays', 'Tối đa')}
                </Space>
              </Hinted>
            ),
          },
          { key: 'pause', label: 'Tạm dừng tối đa', children: <Hinted hint={HINT.pause}>{days('maxPauseDays')}</Hinted> },
          timeScaleRow(p),
        ]} />
      <Space style={{ marginTop: 12 }}>
        <Button type="primary" htmlType="submit" loading={save.isPending}>Lưu thay đổi</Button>
        <Button onClick={onDone} disabled={save.isPending}>Huỷ</Button>
      </Space>
    </Form>
  );
}

function Hinted({ hint, children }: { hint: string; children: ReactNode }) {
  return (
    <div>
      {children}
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>{hint}</Typography.Text>
    </div>
  );
}

const intervalsRow = (p: PolicyDto) => ({
  key: 'intervals', label: 'Nhịp check-in cho phép',
  children: <Item value={<Space size={4} wrap>{(p.allowedCheckInIntervals ?? []).map((d) => <Tag key={d}>{d} ngày</Tag>)}</Space>}
    hint="Owner chọn một trong các nhịp này; quá nhịp mà không check-in thì chuyển sang 'Quá hạn check-in'." />,
});

const timeScaleRow = (p: PolicyDto) => ({
  key: 'timeScale', label: 'Hệ số nén thời gian',
  children: <Item value={(p.timeScale ?? 1) > 1 ? `×${p.timeScale} (1 giờ thật ≈ ${humanizeBusiness(3600_000 * (p.timeScale ?? 1))})` : 'Không nén (thời gian thực)'}
    hint="Chỉ dùng cho môi trường trình diễn; môi trường thật luôn là ×1." />,
});
