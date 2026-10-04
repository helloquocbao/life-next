import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert, Button, Checkbox, Form, Input, Modal, Space, Typography } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@deathnote/api';
import { ErrorAlert, colors } from '@deathnote/ui';
import { api } from '../../config';
import { useOwnerStatus } from '../../lib/api-hooks';
import { useVaultSession } from '../../session/vaultSession';

const CONFIRM_PHRASE = 'XOÁ KÉT';

/**
 * Từ bỏ két cũ khi quên cả passphrase lẫn 12 từ khôi phục — KHÔNG THỂ HOÀN TÁC.
 * Bắt gõ đúng cụm xác nhận + tick 2 ô hiểu hậu quả, để tránh bấm nhầm vào hành động phá huỷ dữ liệu.
 */
export function AbandonModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const status = useOwnerStatus();
  const lock = useVaultSession((s) => s.lock);
  const qc = useQueryClient();
  const [ack1, setAck1] = useState(false);
  const [ack2, setAck2] = useState(false);
  const [typed, setTyped] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();

  // Không thể bắt nhập lại passphrase ở đây (chính nó đã bị quên). Nhưng nếu owner đã bật 2FA,
  // mã 6 số từ Google/Microsoft Authenticator là ĐỘC LẬP với passphrase — vẫn xác thực thêm được.
  const twoFactorEnabled = !!status.data?.vaultUnlockTwoFactorEnabled;
  const canConfirm = ack1 && ack2 && typed.trim() === CONFIRM_PHRASE && (!twoFactorEnabled || code.length === 6);

  const reset = () => { setAck1(false); setAck2(false); setTyped(''); setCode(''); setError(undefined); };

  const confirm = async () => {
    setBusy(true);
    setError(undefined);
    try {
      if (twoFactorEnabled) {
        const ok = await unwrap(api.POST('/api/app/owner/verify-vault-unlock-code', { body: { code } }));
        if (!ok) throw new Error('Mã xác thực không đúng.');
      }
      await unwrap(api.POST('/api/app/vault/abandon'));
      lock(); // xoá VaultKey (nếu còn) khỏi bộ nhớ trình duyệt
      await qc.invalidateQueries();
      reset();
      onClose();
      navigate('/vault', { replace: true });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onCancel={() => { reset(); onClose(); }} footer={null} title={
      <Space><ExclamationCircleOutlined style={{ color: colors.red }} /><span>Từ bỏ két cũ, tạo két mới</span></Space>
    } destroyOnHidden>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Alert type="error" showIcon
          title="Hành động này không thể hoàn tác."
          description={
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              <li>Toàn bộ hạng mục trong két hiện tại sẽ bị xoá vĩnh viễn.</li>
              <li>Mọi phần đã chuẩn bị cho người nhận sẽ bị xoá.</li>
              <li>Không ai — kể cả PICO — có thể khôi phục lại dữ liệu cũ sau bước này.</li>
            </ul>
          } />
        <Typography.Paragraph style={{ margin: 0 }}>
          Sau khi xác nhận, bạn sẽ được đưa lại màn hình thiết lập để tạo két mới với mật khẩu chính
          và 12 từ khôi phục mới. Người thân bạn đã thêm vẫn còn nguyên — bạn chỉ cần chọn lại thông tin cho từng người nhận.
        </Typography.Paragraph>
        <Checkbox checked={ack1} onChange={(e) => setAck1(e.target.checked)}>
          Tôi hiểu toàn bộ dữ liệu trong két hiện tại sẽ mất vĩnh viễn.
        </Checkbox>
        <Checkbox checked={ack2} onChange={(e) => setAck2(e.target.checked)}>
          Tôi đã thử hết cách và chắc chắn không còn nhớ passphrase lẫn 12 từ khôi phục.
        </Checkbox>
        <Form.Item label={<>Gõ chính xác <b>{CONFIRM_PHRASE}</b> để xác nhận</>} style={{ marginBottom: 0 }}>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={CONFIRM_PHRASE} autoComplete="off" />
        </Form.Item>
        <ErrorAlert error={error} />
        <Button danger type="primary" block size="large" disabled={!canConfirm} loading={busy} onClick={confirm}>
          Xoá vĩnh viễn và tạo két mới
        </Button>
      </Space>
    </Modal>
  );
}
