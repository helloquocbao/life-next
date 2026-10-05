/**
 * Home của người được giao vai trò: danh sách hồ sơ (thường chỉ 1). Tự làm mới 10 giây/lần.
 * Không cần tạo khoá hay nhớ passphrase nào — người nhận chỉ cần đăng nhập.
 */
import { Card, Empty, Typography } from 'antd';
import { ErrorAlert, FullPageSpin } from '@deathnote/ui';
import { AssignmentCard } from '../components/trustee/assignment/AssignmentCard';
import { useAssignments } from '../lib/trusteePortalHooks';

export function AssignmentsPage() {
  const assignments = useAssignments();

  if (assignments.isLoading) return <FullPageSpin tip="Đang tải…" />;
  if (assignments.error) return <div className="page-trustee"><ErrorAlert error={assignments.error} /></div>;

  const list = assignments.data ?? [];
  if (list.length === 0)
    return (
      <div className="page-trustee">
        <Card>
          <Empty description={
            <Typography.Paragraph style={{ fontSize: 16 }}>
              Hiện chưa có hồ sơ nào dành cho bạn. Nếu bạn nhận được email từ Death Note, hãy mở đường link trong email đó.
            </Typography.Paragraph>
          } />
        </Card>
      </div>
    );

  return <div className="page-trustee">{list.map((a) => <AssignmentCard key={a.trusteeId} a={a} />)}</div>;
}
