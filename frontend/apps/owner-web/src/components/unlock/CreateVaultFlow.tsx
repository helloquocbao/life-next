import { useRef, useState } from 'react';
import { Alert, Button, Card, Checkbox, Form, Input, Space, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { createVault } from '@deathnote/crypto';
import { unwrap } from '@deathnote/api';
import { ErrorAlert, colors } from '@deathnote/ui';
import { api } from '../../config';
import { qk } from '../../lib/api-hooks';
import { useVaultSession } from '../../session/vaultSession';

/**
 * Tạo két LẦN ĐẦU — hoặc tạo lại sau khi từ bỏ két cũ (xem AbandonModal/DangerZoneCard, cả hai đều
 * dẫn owner quay lại đây vì đây là NƠI DUY NHẤT tạo két). Đúng lúc owner cần dùng tính năng, không
 * phải lúc giới thiệu sản phẩm — xem OnboardingPage.tsx.
 *   Bước A: đặt mật khẩu chính → sinh VaultKey trên trình duyệt → gửi bản đã bọc lên server.
 *   Bước B: hiện 12 từ khôi phục (chỉ một lần), bắt xác nhận đã cất giữ an toàn.
 * Sau khi xong, VaultKey đã có sẵn trong bộ nhớ nên mở khoá luôn, không cần nhập lại passphrase.
 */
export function CreateVaultFlow({ reason }: { reason?: string }) {
  const unlock = useVaultSession((s) => s.unlock);
  const qc = useQueryClient();
  const [phrase, setPhrase] = useState<string>();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  // VaultKey vừa sinh, chờ owner xác nhận đã cất 12 từ ở bước sau rồi mới đưa vào phiên (useVaultSession).
  // Dùng ref (không phải state) vì chỉ đọc lại một lần ở `finish`, không cần render lại khi đổi.
  const pendingKeyRef = useRef<Uint8Array | null>(null);

  const create = async (v: { passphrase: string; confirm: string }) => {
    setBusy(true);
    setError(undefined);
    try {
      const { payload, vaultKey, recoveryPhrase } = await createVault(v.passphrase);
      await unwrap(api.POST('/api/app/vault/initialize', { body: payload }));
      pendingKeyRef.current = vaultKey;
      setPhrase(recoveryPhrase);
      // Chưa unlock() ngay, và CHƯA invalidate query "vault" ở đây — nếu invalidate ngay, `vault.data.initialized`
      // sẽ bật lên true trong khi vaultKey vẫn null, khiến UnlockGate render nhầm sang màn "nhập passphrase để mở
      // khoá" (tưởng vừa tạo két xong lại bị hỏi passphrase lần nữa). Đợi owner xác nhận đã cất 12 từ ở bước sau
      // rồi mới invalidate, lúc đó vaultKey đã có nên UnlockGate sẽ hiện thẳng nội dung.
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      await unwrap(api.POST('/api/app/owner/confirm-recovery-kit'));
      unlock(pendingKeyRef.current!);
      await qc.invalidateQueries({ queryKey: qk.vault });
    } finally {
      setBusy(false);
    }
  };

  if (phrase) {
    return (
      <div className="page-narrow">
        <Card>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Typography.Title level={4} style={{ margin: 0 }}>Bản dự phòng khi quên mật khẩu</Typography.Title>
            <Typography.Paragraph style={{ margin: 0 }}>
              Đây là 12 từ đặc biệt — nếu sau này bạn quên mật khẩu chính, dùng 12 từ này để lấy lại quyền truy cập.
            </Typography.Paragraph>
            <div className="recovery-grid">
              {phrase.split(' ').map((w, i) => <div key={i}><span className="muted">{i + 1}.</span> {w}</div>)}
            </div>
            <Button onClick={() => window.print()} className="no-print">In ra giấy ngay bây giờ</Button>
            <Alert type="warning" showIcon
              title="Hãy cất 12 từ này cùng giấy tờ quan trọng của bạn."
              description="Nếu mất cả thiết bị lẫn 12 từ này, sẽ không ai — kể cả PICO — lấy lại được thông tin cho bạn." />
            <Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ fontSize: 16 }}>
              Tôi đã cất giữ 12 từ này ở nơi an toàn.
            </Checkbox>
            <Button type="primary" size="large" block disabled={!confirmed} loading={busy} onClick={finish}>
              Vào Két thông tin
            </Button>
          </Space>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-narrow">
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Space align="start">
            <LockOutlined style={{ fontSize: 28, color: colors.primary }} />
            <div>
              <Typography.Title level={4} style={{ margin: 0 }}>Tạo két thông tin</Typography.Title>
              <Typography.Text type="secondary">
                {reason ?? 'Đặt một mật khẩu riêng để khoá két này — khác với mật khẩu bạn dùng để đăng nhập.'}
              </Typography.Text>
            </div>
          </Space>
          <Alert type="warning" showIcon
            title="Chúng tôi không lưu mật khẩu này và không thể lấy lại giúp bạn nếu quên."
            description="Ở bước sau, bạn sẽ nhận một bản dự phòng 12 từ để dùng khi quên mật khẩu." />
          <Form layout="vertical" onFinish={create} requiredMark={false}>
            <Form.Item name="passphrase" label="Mật khẩu chính" rules={[{ required: true, min: 10, message: 'Cần ít nhất 10 ký tự' }]}>
              <Input.Password autoFocus size="large" autoComplete="new-password" />
            </Form.Item>
            <Form.Item name="confirm" label="Nhập lại mật khẩu chính" dependencies={['passphrase']}
              rules={[{ required: true, message: 'Vui lòng nhập lại' }, ({ getFieldValue }) => ({
                validator: (_, v) => (v === getFieldValue('passphrase') ? Promise.resolve() : Promise.reject('Hai lần nhập chưa khớp nhau')),
              })]}>
              <Input.Password size="large" autoComplete="new-password" />
            </Form.Item>
            <ErrorAlert error={error} style={{ marginBottom: 16 }} />
            <Button type="primary" htmlType="submit" size="large" block loading={busy}>
              {busy ? 'Đang tạo, vui lòng đợi vài giây…' : 'Tạo két'}
            </Button>
          </Form>
        </Space>
      </Card>
    </div>
  );
}
