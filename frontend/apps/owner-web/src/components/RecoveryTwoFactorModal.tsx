/**
 * Gỡ 2FA bằng 12 từ khôi phục — lối thoát khi owner mất thiết bị xác thực (điện thoại cài
 * Google/Microsoft Authenticator) nhưng còn nhớ passphrase.
 *
 * Cách hoạt động: trình duyệt tự xác minh 12 từ đúng bằng cách thử giải mã RecoveryWrappedKey của
 * chính owner — sai 12 từ sẽ ném lỗi NGAY TẠI ĐÂY, không bao giờ gọi tới server. Chỉ khi giải mã
 * thành công mới gọi API tắt 2FA. 12 từ không bao giờ rời khỏi trình duyệt.
 *
 * Dùng ở 2 nơi:
 *  - UnlockGate (bước nhập mã 2FA sau khi passphrase đúng): gỡ xong thì mở két luôn bằng VaultKey đã có.
 *  - SettingsPage (mục Bảo mật, khi còn 2FA nhưng không có mã): gỡ xong thì tắt 2FA, không cần mở két.
 */
import { useState } from 'react';
import { Alert, Button, Form, Input, Modal, Space, Typography } from 'antd';
import { KeyOutlined } from '@ant-design/icons';
import { isValidRecoveryPhrase, verifyRecoveryPhrase, type WrappedVault } from '@deathnote/crypto';
import { unwrap } from '@deathnote/api';
import { ErrorAlert } from '@deathnote/ui';
import { api } from '../config';

export function RecoveryTwoFactorModal({ open, vault, onClose, onDone }: {
  open: boolean;
  /** Vật liệu khoá đã bọc của owner (GET /api/app/vault) — cần để kiểm tra 12 từ. */
  vault?: WrappedVault;
  onClose: () => void;
  /** Gọi sau khi đã tắt 2FA thành công trên server. */
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();

  const onFinish = async (v: { phrase: string }) => {
    if (!vault) return;
    setBusy(true);
    setError(undefined);
    try {
      // Sai 12 từ → decrypt ném lỗi ngay đây, KHÔNG gọi API. Đúng thì server tắt 2FA vô điều kiện,
      // vì bằng chứng đã được kiểm tra xong ở bước này.
      await verifyRecoveryPhrase(vault, v.phrase);
      await unwrap(api.POST('/api/app/owner/disable-two-factor-via-recovery'));
      onDone();
    } catch (e) {
      setError(new Error('12 từ khôi phục không đúng.'));
      void e;
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={<Space><KeyOutlined />Gỡ 2FA bằng 12 từ khôi phục</Space>} destroyOnHidden>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Alert type="info" showIcon
          title="Dùng khi mất điện thoại cài ứng dụng xác thực."
          description="Nhập đúng 12 từ khôi phục bạn đã cất giữ lúc tạo két — 2FA sẽ được tắt ngay, bạn có thể bật lại sau nếu muốn." />
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item name="phrase" label="12 từ khôi phục (cách nhau bởi dấu cách)"
            rules={[{ validator: (_, v) => (isValidRecoveryPhrase(v ?? '') ? Promise.resolve() : Promise.reject('12 từ không hợp lệ')) }]}>
            <Input.TextArea rows={3} autoComplete="off" spellCheck={false} autoFocus />
          </Form.Item>
          <ErrorAlert error={error} style={{ marginBottom: 16 }} />
          <Button type="primary" htmlType="submit" loading={busy} block disabled={!vault}>Xác minh & tắt 2FA</Button>
        </Form>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          Không nhớ cả 12 từ này? Đây là giới hạn của thiết kế bảo mật zero-knowledge — không ai, kể cả
          PICO, khôi phục giúp được. Bạn vẫn có thể "Tạo két mới" nếu cần, nhưng sẽ mất dữ liệu cũ.
        </Typography.Text>
      </Space>
    </Modal>
  );
}
