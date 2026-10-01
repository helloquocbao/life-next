import { useState } from 'react';
import { Alert, App, Button, Card, Form, Input, Space, Tag, Typography } from 'antd';
import { QRCodeSVG } from 'qrcode.react';
import { useQueryClient } from '@tanstack/react-query';
import { rewrapWithPassphrase, unlockVault } from '@deathnote/crypto';
import { unwrap } from '@deathnote/api';
import { ErrorAlert } from '@deathnote/ui';
import { api } from '../../config';
import { qk, useInvalidateOwner, useOwnerStatus, useVault } from '../../lib/api-hooks';
import { useVaultSession } from '../../session/vaultSession';
import { RecoveryTwoFactorModal } from '../RecoveryTwoFactorModal';
import { DangerZoneCard } from './DangerZoneCard';

export function SecurityTab() {
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
  const [lostTotpOpen, setLostTotpOpen] = useState(false);
  const twoFactor = !!status.data?.vaultUnlockTwoFactorEnabled;

  const startSetup = async () => setSetup(await unwrap(api.GET('/api/app/owner/two-factor-setup')));
  const enable = async () => {
    setError(undefined);
    try {
      await unwrap(api.POST(twoFactor ? '/api/app/owner/disable-two-factor' : '/api/app/owner/enable-two-factor', { body: { code } }));
      setSetup(undefined);
      setCode('');
      await invalidate();
      message.success(twoFactor ? 'Đã tắt xác thực hai lớp.' : 'Đã bật xác thực hai lớp khi mở két.');
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
      <Card title="Xác thực hai lớp khi mở két" extra={twoFactor ? <Tag color="green">Đang bật</Tag> : <Tag>Chưa bật</Tag>}>
        <Typography.Paragraph type="secondary">
          Khi bật, mỗi lần mở két (sau khi nhập đúng passphrase) bạn còn phải nhập thêm mã 6 số từ
          Google Authenticator / Microsoft Authenticator mới thực sự xem được nội dung — thêm một lớp
          bảo vệ ngay tại thời điểm nhạy cảm nhất.
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
          <Space direction="vertical">
            <Space>
              <Input.OTP length={6} value={code} onChange={setCode} />
              <Button danger onClick={enable}>Tắt</Button>
            </Space>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Mất thiết bị xác thực?{' '}
              <Typography.Link onClick={() => setLostTotpOpen(true)} style={{ fontSize: 13 }}>Dùng 12 từ khôi phục để tắt</Typography.Link>
            </Typography.Text>
          </Space>
        )}
      </Card>
      <RecoveryTwoFactorModal open={lostTotpOpen} vault={vault.data} onClose={() => setLostTotpOpen(false)}
        onDone={async () => { setLostTotpOpen(false); await invalidate(); message.success('Đã tắt xác thực hai lớp.'); }} />

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

      <DangerZoneCard twoFactorEnabled={twoFactor} />
    </Space>
  );
}
