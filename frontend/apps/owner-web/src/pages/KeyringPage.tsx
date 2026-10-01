/** Trang tạo khoá cá nhân — truy cập từ Home khi đã nhận vai trò nhưng chưa tạo khoá. */
import { Button, Card, Result } from 'antd';
import { useNavigate } from 'react-router';
import { ErrorAlert, FullPageSpin } from '@deathnote/ui';
import { KeyringSetupForm } from '../components/trustee/KeyringSetupForm';
import { useKeyring } from '../lib/trusteePortalHooks';

export function KeyringPage() {
  const navigate = useNavigate();
  const keyring = useKeyring();

  if (keyring.isLoading) return <FullPageSpin />;
  if (keyring.error) return <div className="page-trustee"><ErrorAlert error={keyring.error} /></div>;

  if (keyring.data?.exists)
    return (
      <div className="page-trustee">
        <Card>
          <Result status="success" title="Bạn đã có khoá cá nhân"
            subTitle="Hãy giữ passphrase ở nơi an toàn. PICO không thể khôi phục nếu bạn quên."
            extra={<Button type="primary" onClick={() => navigate('/assignments')}>Về Hồ sơ tôi giữ giúp</Button>} />
        </Card>
      </div>
    );

  return (
    <div className="page-trustee">
      <Card>
        <KeyringSetupForm onDone={() => navigate('/assignments', { replace: true })} />
      </Card>
    </div>
  );
}
