import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert, Button, Card, Checkbox, Form, Input, Modal, Space, Typography } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { unlockVault } from '@deathnote/crypto';
import { unwrap } from '@deathnote/api';
import { ErrorAlert, colors } from '@deathnote/ui';
import { api } from '../../config';
import { useVault } from '../../lib/api-hooks';
import { useVaultSession } from '../../session/vaultSession';

/**
 * Xoá két chủ động (khác với "Tạo két mới" ở màn mở khoá — chỗ đó dành cho lúc QUÊN passphrase).
 * Ở đây owner còn nhớ passphrase, nên bắt xác thực đủ 2 yếu tố trước khi xoá:
 *   1. Nhập lại đúng passphrase hiện tại (kiểm tra bằng cách thử giải mã VaultKey ngay trên trình duyệt).
 *   2. Nếu đã bật 2FA, nhập thêm mã 6 số từ Google/Microsoft Authenticator (kiểm tra qua server).
 * Chỉ khi cả hai đều đúng mới gọi API xoá — không thể hoàn tác.
 */
export function DangerZoneCard({ twoFactorEnabled }: { twoFactorEnabled: boolean }) {
  const vault = useVault();
  const navigate = useNavigate();
  const lock = useVaultSession((s) => s.lock);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();

  const close = () => { setOpen(false); setAck(false); setError(undefined); };

  const onFinish = async (v: { passphrase: string; code?: string }) => {
    setBusy(true);
    setError(undefined);
    try {
      // Yếu tố 1: đúng passphrase hiện tại — thử giải mã ngay trên trình duyệt, không gửi passphrase lên server.
      const key = await unlockVault(vault.data!, v.passphrase).catch(() => { throw new Error('Passphrase không đúng.'); });
      key.fill(0); // chỉ cần biết giải mã được, không cần giữ khoá lại

      // Yếu tố 2: mã 2FA (nếu đã bật) — xác thực qua server, không có tác dụng phụ.
      if (twoFactorEnabled) {
        const ok = await unwrap(api.POST('/api/app/owner/verify-vault-unlock-code', { body: { code: v.code ?? '' } }));
        if (!ok) throw new Error('Mã xác thực không đúng.');
      }

      await unwrap(api.POST('/api/app/vault/abandon'));
      lock();
      await qc.invalidateQueries();
      close();
      navigate('/vault', { replace: true });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={<Space><ExclamationCircleOutlined style={{ color: colors.red }} /><span>Vùng nguy hiểm</span></Space>} style={{ borderColor: colors.red }}>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
        Xoá vĩnh viễn toàn bộ két hiện tại (hạng mục và phần đã chuẩn bị cho người nhận) và bắt đầu lại
        từ đầu với két mới. Không thể hoàn tác.
      </Typography.Paragraph>
      <Button danger onClick={() => setOpen(true)}>Xoá két này</Button>

      <Modal open={open} onCancel={close} footer={null} title="Xác nhận xoá két" destroyOnHidden>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Alert type="error" showIcon title="Toàn bộ dữ liệu trong két sẽ mất vĩnh viễn, không thể khôi phục." />
          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item name="passphrase" label="Nhập lại passphrase hiện tại" rules={[{ required: true, message: 'Bắt buộc' }]}>
              <Input.Password autoComplete="current-password" autoFocus />
            </Form.Item>
            {twoFactorEnabled && (
              <Form.Item name="code" label="Mã xác thực từ Google/Microsoft Authenticator" rules={[{ required: true, len: 6, message: 'Nhập đủ 6 số' }]}>
                <Input.OTP length={6} />
              </Form.Item>
            )}
            <Checkbox checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ marginBottom: 16 }}>
              Tôi hiểu hành động này không thể hoàn tác.
            </Checkbox>
            <ErrorAlert error={error} style={{ marginBottom: 16 }} />
            <Button danger type="primary" htmlType="submit" block disabled={!ack} loading={busy}>
              Xoá vĩnh viễn két này
            </Button>
          </Form>
        </Space>
      </Modal>
    </Card>
  );
}
