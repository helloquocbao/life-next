/**
 * Cổng mở khoá két. Nội dung vault chỉ hiển thị sau khi owner nhập passphrase — VaultKey được giải bọc
 * NGAY TRÊN TRÌNH DUYỆT (Argon2id ~1 giây). Server không bao giờ nhận passphrase.
 * Quên passphrase → khôi phục bằng 12 từ và đặt passphrase mới (xem components/unlock/RecoverModal.tsx).
 * Quên CẢ HAI (passphrase lẫn 12 từ) → không còn cách khôi phục do thiết kế zero-knowledge; chỉ còn
 * cách từ bỏ két cũ và tạo két mới (mất vĩnh viễn dữ liệu cũ) — xem components/unlock/AbandonModal.tsx.
 * Chưa từng tạo két → xem components/unlock/CreateVaultFlow.tsx.
 */
import { useState, type ReactNode } from 'react';
import { Button, Card, Form, Input, Space, Typography } from 'antd';
import { LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { unlockVault, wipe } from '@deathnote/crypto';
import { unwrap } from '@deathnote/api';
import { ErrorAlert, FullPageSpin, colors } from '@deathnote/ui';
import { api } from '../config';
import { useOwnerStatus, useVault, qk } from '../lib/api-hooks';
import { useVaultSession } from '../session/vaultSession';
import { RecoveryTwoFactorModal } from './RecoveryTwoFactorModal';
import { AbandonModal } from './unlock/AbandonModal';
import { CreateVaultFlow } from './unlock/CreateVaultFlow';
import { RecoverModal } from './unlock/RecoverModal';

export function UnlockGate({ children, reason }: { children: ReactNode; reason?: string }) {
  const vaultKey = useVaultSession((s) => s.vaultKey);
  const unlock = useVaultSession((s) => s.unlock);
  const vault = useVault();
  const status = useOwnerStatus();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [lostTotpOpen, setLostTotpOpen] = useState(false);
  // Sau khi passphrase đúng, nếu owner đã bật 2FA thì VaultKey tạm giữ ở đây chờ thêm mã 6 số
  // trước khi thực sự đưa vào phiên (useVaultSession) — chưa xác thực xong thì nội dung chưa hiện ra.
  const [pendingKey, setPendingKey] = useState<Uint8Array | null>(null);
  const [totpCode, setTotpCode] = useState('');

  if (vaultKey) return <>{children}</>;
  if (vault.isLoading || status.isLoading) return <FullPageSpin />;
  // Chưa từng tạo két (lần đầu vào tính năng, hoặc vừa từ bỏ két cũ) → tạo két ngay tại đây,
  // đúng lúc owner cần dùng — không bắt tạo trước trong lúc giới thiệu sản phẩm.
  if (!vault.data?.initialized) return <CreateVaultFlow reason={reason} />;

  const twoFactorEnabled = !!status.data?.vaultUnlockTwoFactorEnabled;

  const onFinish = async ({ passphrase }: { passphrase: string }) => {
    setBusy(true);
    setError(undefined);
    try {
      const key = await unlockVault(vault.data!, passphrase);
      if (twoFactorEnabled) setPendingKey(key); // sang bước nhập mã 2FA, chưa mở khoá phiên
      else unlock(key);
    } catch (e) {
      setError(new Error('Passphrase không đúng.'));
      void e;
    } finally {
      setBusy(false);
    }
  };

  const verifyTotp = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const ok = await unwrap(api.POST('/api/app/owner/verify-vault-unlock-code', { body: { code: totpCode } }));
      if (!ok) throw new Error('Mã xác thực không đúng.');
      unlock(pendingKey!);
      setPendingKey(null);
      setTotpCode('');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const cancelTotp = () => {
    wipe(pendingKey ?? undefined);
    setPendingKey(null);
    setTotpCode('');
    setError(undefined);
  };

  const onRecoveredFromLostTotp = async () => {
    setLostTotpOpen(false);
    unlock(pendingKey!); // passphrase đã xác thực đúng ở bước trước, 12 từ vừa chứng minh chủ két → mở luôn
    setPendingKey(null);
    setTotpCode('');
    await qc.invalidateQueries({ queryKey: qk.status });
  };

  // ---------- Bước 2: mã xác thực 2FA (chỉ hiện khi owner đã bật, và passphrase vừa đúng) ----------
  if (pendingKey) {
    return (
      <div className="page-narrow">
        <Card>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Space align="start">
              <SafetyOutlined style={{ fontSize: 28, color: colors.primary }} />
              <div>
                <Typography.Title level={4} style={{ margin: 0 }}>Nhập mã xác thực</Typography.Title>
                <Typography.Text type="secondary">
                  Passphrase đúng rồi. Nhập thêm mã 6 số từ Google/Microsoft Authenticator để hoàn tất mở két.
                </Typography.Text>
              </div>
            </Space>
            <Input.OTP length={6} value={totpCode} onChange={setTotpCode} autoFocus onInput={() => setError(undefined)} />
            <ErrorAlert error={error} />
            <Space>
              <Button type="primary" size="large" loading={busy} disabled={totpCode.length !== 6} onClick={verifyTotp}>Xác nhận</Button>
              <Button onClick={cancelTotp}>Quay lại</Button>
            </Space>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Mất thiết bị xác thực?{' '}
              <Typography.Link onClick={() => setLostTotpOpen(true)} style={{ fontSize: 13 }}>Dùng 12 từ khôi phục</Typography.Link>
            </Typography.Text>
          </Space>
        </Card>
        <RecoveryTwoFactorModal open={lostTotpOpen} vault={vault.data} onClose={() => setLostTotpOpen(false)} onDone={onRecoveredFromLostTotp} />
      </div>
    );
  }

  return (
    <div className="page-narrow">
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Space align="start">
            <LockOutlined style={{ fontSize: 28, color: '#2f6f5e' }} />
            <div>
              <Typography.Title level={4} style={{ margin: 0 }}>Mở khoá két dữ liệu</Typography.Title>
              <Typography.Text type="secondary">
                {reason ?? 'Nội dung được mã hoá trên thiết bị của bạn. Nhập passphrase để xem.'}
              </Typography.Text>
            </div>
          </Space>
          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item name="passphrase" label="Passphrase" rules={[{ required: true, message: 'Nhập passphrase' }]}>
              <Input.Password autoFocus size="large" autoComplete="current-password" />
            </Form.Item>
            <ErrorAlert error={error} style={{ marginBottom: 16 }} />
            <Space>
              <Button type="primary" htmlType="submit" size="large" loading={busy}>Mở khoá</Button>
              <Button type="link" onClick={() => setRecoverOpen(true)}>Quên passphrase?</Button>
            </Space>
          </Form>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Phiên tự khoá sau 10 phút không thao tác.
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Quên cả passphrase lẫn 12 từ khôi phục?{' '}
            <Typography.Link onClick={() => setAbandonOpen(true)} style={{ fontSize: 13 }}>Tạo két mới</Typography.Link>
          </Typography.Text>
        </Space>
      </Card>
      <RecoverModal open={recoverOpen} onClose={() => setRecoverOpen(false)} onNeedAbandon={() => { setRecoverOpen(false); setAbandonOpen(true); }} />
      <AbandonModal open={abandonOpen} onClose={() => setAbandonOpen(false)} />
    </div>
  );
}
