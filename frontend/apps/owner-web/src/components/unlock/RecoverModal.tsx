import { useState } from 'react';
import { App, Button, Form, Input, Modal } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { isValidRecoveryPhrase, recoverVault } from '@deathnote/crypto';
import { unwrap } from '@deathnote/api';
import { ErrorAlert } from '@deathnote/ui';
import { api } from '../../config';
import { qk, useOwnerStatus, useVault } from '../../lib/api-hooks';
import { useVaultSession } from '../../session/vaultSession';

/** Khôi phục bằng 12 từ → đặt passphrase mới (bọc lại VaultKey rồi gửi server). */
export function RecoverModal({ open, onClose, onNeedAbandon }: { open: boolean; onClose: () => void; onNeedAbandon: () => void }) {
  const vault = useVault();
  const status = useOwnerStatus();
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
      // 12 từ vừa chứng minh là chủ két — nếu đang bật 2FA thì tắt luôn, tránh khôi phục xong lại
      // kẹt ngay ở bước nhập mã 6 số (đằng nào 2FA cũng gắn với thiết bị đã mất, không dùng được nữa).
      if (status.data?.vaultUnlockTwoFactorEnabled) {
        await unwrap(api.POST('/api/app/owner/disable-two-factor-via-recovery'));
      }
      unlock(vaultKey);
      await qc.invalidateQueries({ queryKey: qk.vault });
      await qc.invalidateQueries({ queryKey: qk.status });
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
        <Button type="link" block onClick={onNeedAbandon} style={{ marginTop: 4 }}>
          Không nhớ 12 từ này nữa — tạo két mới
        </Button>
      </Form>
    </Modal>
  );
}
