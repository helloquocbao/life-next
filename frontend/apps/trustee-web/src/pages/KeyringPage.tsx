/** Trang tạo khoá cá nhân — truy cập từ Home khi đã nhận vai trò nhưng chưa tạo khoá. */
import { Button, Card, Result } from 'antd';
import { useNavigate } from 'react-router';
import { ErrorAlert, FullPageSpin } from '@deathnote/ui';
import { KeyringSetupForm } from '../components/KeyringSetupForm';
import { useKeyring } from '../lib/api-hooks';

export function KeyringPage() {
  const navigate = useNavigate();
  const keyring = useKeyring();

  if (keyring.isLoading) return <FullPageSpin />;
  if (keyring.error) return <ErrorAlert error={keyring.error} />;

  if (keyring.data?.exists)
    return (
      <Card>
        <Result status="success" title="Bạn đã có khoá cá nhân"
          subTitle="Hãy giữ passphrase ở nơi an toàn. PICO không thể khôi phục nếu bạn quên."
          extra={<Button type="primary" onClick={() => navigate('/')}>Về trang chính</Button>} />
      </Card>
    );

  return (
    <Card>
      <KeyringSetupForm onDone={() => navigate('/', { replace: true })} />
    </Card>
  );
}
