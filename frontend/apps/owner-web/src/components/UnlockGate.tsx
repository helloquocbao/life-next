/**
 * Cổng mở khoá két. Nội dung vault chỉ hiển thị sau khi owner nhập passphrase — VaultKey được giải bọc
 * NGAY TRÊN TRÌNH DUYỆT (Argon2id ~1 giây). Server không bao giờ nhận passphrase.
 * Quên passphrase → khôi phục bằng 12 từ và đặt passphrase mới.
 */
import { useState, type ReactNode } from 'react';
import { App, Button, Card, Form, Input, Modal, Space, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { isValidRecoveryPhrase, recoverVault, unlockVault } from '@deathnote/crypto';
import { unwrap } from '@deathnote/api';
import { ErrorAlert, FullPageSpin } from '@deathnote/ui';
import { api } from '../config';
import { useVault, qk } from '../lib/api-hooks';
import { useVaultSession } from '../session/vaultSession';

export function UnlockGate({ children, reason }: { children: ReactNode; reason?: string }) {
  const vaultKey = useVaultSession((s) => s.vaultKey);
  const unlock = useVaultSession((s) => s.unlock);
  const vault = useVault();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [recoverOpen, setRecoverOpen] = useState(false);

  if (vaultKey) return <>{children}</>;
  if (vault.isLoading) return <FullPageSpin />;
  if (!vault.data?.initialized) return <ErrorAlert error={new Error('Két dữ liệu chưa được tạo.')} />;

  const onFinish = async ({ passphrase }: { passphrase: string }) => {
    setBusy(true);
    setError(undefined);
    try {
      unlock(await unlockVault(vault.data!, passphrase));
    } catch (e) {
      setError(new Error('Passphrase không đúng.'));
      void e;
    } finally {
      setBusy(false);
    }
  };

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
        </Space>
      </Card>
      <RecoverModal open={recoverOpen} onClose={() => setRecoverOpen(false)} />
    </div>
  );
}

/** Khôi phục bằng 12 từ → đặt passphrase mới (bọc lại VaultKey rồi gửi server). */
function RecoverModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const vault = useVault();
  const unlock = useVaultSession((s) => s.unlock);
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();

  const onFinish = async (v: { phrase: string; passphrase: string }) => {
    setBusy(true);
    setError(undefined);
    try {
      const { vaultKey, changePassphrase } = await recoverVault(vault.data!, v.phrase, v.passphrase);
      await unwrap(api.POST('/api/app/vault/change-passphrase', { body: changePassphrase }));
      unlock(vaultKey);
      await qc.invalidateQueries({ queryKey: qk.vault });
      message.success('Đã khôi phục và đặt passphrase mới.');
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} title="Khôi phục bằng 12 từ" destroyOnHidden>
      <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item name="phrase" label="12 từ khôi phục (cách nhau bởi dấu cách)"
          rules={[{ validator: (_, v) => (isValidRecoveryPhrase(v ?? '') ? Promise.resolve() : Promise.reject('12 từ không hợp lệ')) }]}>
          <Input.TextArea rows={3} autoComplete="off" spellCheck={false} />
        </Form.Item>
        <Form.Item name="passphrase" label="Passphrase mới" rules={[{ required: true, min: 10, message: 'Tối thiểu 10 ký tự' }]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <ErrorAlert error={error} style={{ marginBottom: 16 }} />
        <Button type="primary" htmlType="submit" loading={busy} block>Khôi phục</Button>
      </Form>
    </Modal>
  );
}
