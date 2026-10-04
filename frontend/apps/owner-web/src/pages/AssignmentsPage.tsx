/**
 * Home của người được uỷ quyền: danh sách hồ sơ (thường chỉ 1). Tự làm mới 10 giây/lần.
 * Nếu đã nhận vai trò nhưng chưa tạo khoá cá nhân → việc cần làm duy nhất là tạo khoá.
 */
import { Button, Card, Empty, Typography } from 'antd';
import { KeyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router';
import { TrusteeRole } from '@deathnote/api';
import { ErrorAlert, FullPageSpin } from '@deathnote/ui';
import { AssignmentCard } from '../components/trustee/assignment/AssignmentCard';
import { useAssignments, useKeyring } from '../lib/trusteePortalHooks';

export function AssignmentsPage() {
  const navigate = useNavigate();
  const assignments = useAssignments();
  const keyring = useKeyring();

  if (assignments.isLoading || keyring.isLoading) return <FullPageSpin tip="Đang tải…" />;
  if (assignments.error || keyring.error)
    return <div className="page-trustee"><ErrorAlert error={assignments.error ?? keyring.error} /></div>;

  const list = assignments.data ?? [];
  // Chỉ người nhận thông tin mới cần khoá cá nhân (phần dành cho họ được niêm phong bằng khoá đó).
  const needsKeyring = list.some((a) => a.role === TrusteeRole.Recipient) && !keyring.data?.exists;

  if (list.length === 0)
    return (
      <div className="page-trustee">
        <Card>
          <Empty description={
            <Typography.Paragraph style={{ fontSize: 16 }}>
              Bạn chưa là người được uỷ quyền của ai. Nếu bạn nhận được email mời, hãy mở đường link trong email đó.
            </Typography.Paragraph>
          } />
        </Card>
      </div>
    );

  return (
    <div className="page-trustee">
      {needsKeyring && (
        <Card style={{ marginBottom: 24, borderColor: '#c98a16' }}>
          <p className="lead"><KeyOutlined style={{ marginRight: 10 }} />Việc cần làm: tạo khoá cá nhân</p>
          <Typography.Paragraph style={{ marginTop: 12 }}>
            Người đã chọn bạn cần khoá công khai của bạn để niêm phong phần dành riêng cho bạn — thiếu bước này, bạn không nhận được gì. Chỉ mất một phút.
          </Typography.Paragraph>
          <Button type="primary" size="large" block onClick={() => navigate('/keyring')}>Tạo khoá cá nhân</Button>
        </Card>
      )}
      {list.map((a) => <AssignmentCard key={a.trusteeId} a={a} />)}
    </div>
  );
}
