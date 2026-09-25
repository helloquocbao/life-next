/**
 * CÀI ĐẶT & AN TOÀN
 *  - Nhịp check-in, thời gian ân hạn, thông tin liên hệ.
 *  - Chế độ tạm dừng có thời hạn (du lịch / nhập viện) — tự hết hạn.
 *  - Bảo mật: xác thực hai lớp cho check-in, đổi passphrase, bộ khôi phục, khoá phiên.
 *  - Nhật ký hoạt động: owner xem được TOÀN BỘ log của chính mình (append-only, có chuỗi băm).
 *  - Gói dịch vụ.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { App, Alert, Button, Card, DatePicker, Descriptions, Form, Input, Radio, Slider, Space, Table, Tabs, Tag, Typography } from 'antd';
import { QRCodeSVG } from 'qrcode.react';
import { useQueryClient } from '@tanstack/react-query';
import { rewrapWithPassphrase, unlockVault } from '@deathnote/crypto';
import { unwrap, type AuditEventDto } from '@deathnote/api';
import {
  ErrorAlert, auditActionLabel, auditActorTypeLabel, checkInChannelLabel, dayjs, formatDateTime, parseUtc,
} from '@deathnote/ui';
import { api } from '../config';
import { useActivity, useHeartbeats, useInvalidateOwner, useOwnerStatus, useVault, qk } from '../lib/api-hooks';
import { useVaultSession } from '../session/vaultSession';

export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  return (
    <div className="page">
      <Typography.Title level={2}>Cài đặt</Typography.Title>
      <Tabs activeKey={params.get('tab') ?? 'schedule'} onChange={(tab) => setParams({ tab })} items={[
        { key: 'schedule', label: 'Nhịp check-in', children: <ScheduleTab /> },
        { key: 'pause', label: 'Tạm dừng', children: <PauseTab /> },
        { key: 'security', label: 'Bảo mật', children: <SecurityTab /> },
        { key: 'activity', label: 'Nhật ký hoạt động', children: <ActivityTab /> },
        { key: 'plan', label: 'Gói dịch vụ', children: <PlanTab /> },
      ]} />
    </div>
  );
}

function ScheduleTab() {
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

function PauseTab() {
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

function SecurityTab() {
  const status = useOwnerStatus();
  const vault = useVault();
  const invalidate = useInvalidateOwner();
  const lock = useVaultSession((s) => s.lock);
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [setup, setSetup] = useState<{ sharedKey?: string; authenticatorUri?: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<unknown>();
  const [pwBusy, setPwBusy] = useState(false);
  const twoFactor = !!status.data?.checkInTwoFactorEnabled;

  const startSetup = async () => setSetup(await unwrap(api.GET('/api/app/owner/two-factor-setup')));
  const enable = async () => {
    setError(undefined);
    try {
      await unwrap(api.POST(twoFactor ? '/api/app/owner/disable-two-factor' : '/api/app/owner/enable-two-factor', { body: { code } }));
      setSetup(undefined);
      setCode('');
      await invalidate();
      message.success(twoFactor ? 'Đã tắt xác thực hai lớp.' : 'Đã bật xác thực hai lớp cho check-in.');
    } catch (e) { setError(e); }
  };

  /** Đổi passphrase: mở VaultKey bằng passphrase cũ rồi bọc lại bằng passphrase mới — hoàn toàn trên trình duyệt. */
  const changePassphrase = async (v: { current: string; next: string }) => {
    setPwBusy(true);
    setError(undefined);
    try {
      const key = await unlockVault(vault.data!, v.current).catch(() => { throw new Error('Passphrase hiện tại không đúng.'); });
      await unwrap(api.POST('/api/app/vault/change-passphrase', { body: await rewrapWithPassphrase(key, v.next) }));
      await qc.invalidateQueries({ queryKey: qk.vault });
      message.success('Đã đổi passphrase.');
    } catch (e) { setError(e); } finally { setPwBusy(false); }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <ErrorAlert error={error} />
      <Card title="Xác thực hai lớp cho check-in" extra={twoFactor ? <Tag color="green">Đang bật</Tag> : <Tag>Chưa bật</Tag>}>
        <Typography.Paragraph type="secondary">
          Khi bật, mỗi lần check-in từ web cần thêm mã 6 số từ Google Authenticator / Microsoft Authenticator —
          để không ai khác "giả làm bạn vẫn ổn" nếu lấy được phiên đăng nhập.
        </Typography.Paragraph>
        {!twoFactor && !setup && <Button type="primary" onClick={startSetup}>Thiết lập</Button>}
        {!twoFactor && setup?.authenticatorUri && (
          <Space align="start" size="large" wrap>
            <QRCodeSVG value={setup.authenticatorUri} size={160} />
            <div>
              <div>Quét mã QR bằng ứng dụng xác thực, hoặc nhập khoá:</div>
              <Typography.Text code copyable>{setup.sharedKey}</Typography.Text>
              <div style={{ marginTop: 12 }}><Input.OTP length={6} value={code} onChange={setCode} /></div>
              <Button type="primary" style={{ marginTop: 12 }} onClick={enable}>Xác nhận & bật</Button>
            </div>
          </Space>
        )}
        {twoFactor && (
          <Space>
            <Input.OTP length={6} value={code} onChange={setCode} />
            <Button danger onClick={enable}>Tắt</Button>
          </Space>
        )}
      </Card>

      <Card title="Đổi passphrase">
        <Form layout="vertical" onFinish={changePassphrase} style={{ maxWidth: 420 }} requiredMark={false}>
          <Form.Item name="current" label="Passphrase hiện tại" rules={[{ required: true }]}><Input.Password autoComplete="current-password" /></Form.Item>
          <Form.Item name="next" label="Passphrase mới" rules={[{ required: true, min: 10, message: 'Tối thiểu 10 ký tự' }]}><Input.Password autoComplete="new-password" /></Form.Item>
          <Button type="primary" htmlType="submit" loading={pwBusy}>Đổi passphrase</Button>
        </Form>
      </Card>

      <Card title="Bộ khôi phục 12 từ">
        <Space direction="vertical">
          {status.data?.recoveryKitConfirmed
            ? <Alert type="success" showIcon title="Bạn đã xác nhận cất giữ 12 từ khôi phục." />
            : <Alert type="warning" showIcon title="Bạn chưa xác nhận đã cất giữ 12 từ khôi phục." />}
          <Typography.Text type="secondary">
            Nhắc lại: mất cả thiết bị lẫn 12 từ thì không ai khôi phục được dữ liệu — kể cả PICO. Hãy kiểm tra lại nơi cất giữ định kỳ.
          </Typography.Text>
          {!status.data?.recoveryKitConfirmed && (
            <Button onClick={async () => { await unwrap(api.POST('/api/app/owner/confirm-recovery-kit')); await invalidate(); }}>
              Tôi đã cất giữ 12 từ
            </Button>
          )}
        </Space>
      </Card>

      <Card title="Phiên làm việc">
        <Space direction="vertical">
          <Typography.Text type="secondary">Khoá két trong bộ nhớ trình duyệt; tự khoá sau 10 phút không thao tác.</Typography.Text>
          <Button onClick={() => { lock(); message.info('Đã khoá két.'); }}>Khoá két ngay</Button>
        </Space>
      </Card>
    </Space>
  );
}

function ActivityTab() {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const activity = useActivity((page - 1) * pageSize, pageSize);
  const heartbeats = useHeartbeats();
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="Nhật ký hoạt động" extra={<span className="muted">Append-only · mỗi dòng có mã băm nối chuỗi</span>} styles={{ body: { padding: 0 } }}>
        <ErrorAlert error={activity.error} />
        <Table<AuditEventDto> rowKey="sequence" size="small" loading={activity.isLoading} dataSource={activity.data?.items ?? []}
          pagination={{ current: page, pageSize, total: activity.data?.totalCount ?? 0, onChange: setPage, showSizeChanger: false }}
          columns={[
            { title: 'Thời gian', dataIndex: 'occurredAt', width: 150, render: (v) => formatDateTime(v) },
            { title: 'Ai', render: (_, e) => <span>{e.actorName ?? auditActorTypeLabel[e.actorType ?? 0]} <span className="muted">({auditActorTypeLabel[e.actorType ?? 0]})</span></span> },
            { title: 'Hành động', dataIndex: 'action', render: (a: string) => auditActionLabel[a] ?? a },
            { title: 'Chi tiết', dataIndex: 'detail', ellipsis: true },
            { title: 'IP', dataIndex: 'ipAddress', width: 120 },
          ]} />
      </Card>
      <Card title="Lịch sử check-in" styles={{ body: { padding: 0 } }}>
        <Table rowKey={(h) => h.occurredAt ?? ''} size="small" loading={heartbeats.isLoading} dataSource={heartbeats.data ?? []} pagination={{ pageSize: 10 }}
          columns={[
            { title: 'Thời gian', dataIndex: 'occurredAt', render: (v) => formatDateTime(v) },
            { title: 'Kênh', dataIndex: 'channel', render: (c: 0 | 1 | 2 | 3) => checkInChannelLabel[c] },
            { title: 'IP', dataIndex: 'ipAddress' },
            { title: '', dataIndex: 'wasVeto', render: (v) => (v ? <Tag color="red">Phủ quyết</Tag> : null) },
          ]} />
      </Card>
      <span style={{ display: 'none' }}>{String(parseUtc)}</span>
    </Space>
  );
}

function PlanTab() {
  return (
    <Card title="Gói dịch vụ">
      <Descriptions column={1} bordered>
        <Descriptions.Item label="Gói hiện tại"><Tag color="green">Early access (miễn phí)</Tag></Descriptions.Item>
        <Descriptions.Item label="Dung lượng két">Không giới hạn số hạng mục · tệp đính kèm tối đa 2 MB/tệp</Descriptions.Item>
        <Descriptions.Item label="Người được uỷ quyền">Không giới hạn</Descriptions.Item>
      </Descriptions>
      <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>Gói gia đình và kênh đối tác (bảo hiểm, ngân hàng, công chứng) — Phase 3.</Typography.Paragraph>
    </Card>
  );
}
