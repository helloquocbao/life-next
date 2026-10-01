/** Giai đoạn "Đã mở": chỉ một việc — mở hộp nhận. */
import { Button, Typography } from 'antd';
import { useNavigate } from 'react-router';
import type { AssignmentDto } from '@deathnote/api';
import { formatDateTime } from '@deathnote/ui';

export function ReleasedPhase({ a }: { a: AssignmentDto }) {
  const navigate = useNavigate();
  return (
    <>
      <p className="lead">Phần {a.ownerName} để lại cho bạn đã sẵn sàng.</p>
      <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
        Hồ sơ được mở lúc {formatDateTime(a.releasedAt ?? a.openRequest?.releasedAt)}. Bạn sẽ cần passphrase khoá cá nhân.
        Hãy mở khi bạn sẵn sàng — không có gì phải vội.
      </Typography.Paragraph>
      <Button type="primary" size="large" block style={{ height: 60, fontSize: 18 }} onClick={() => navigate(`/inbox/${a.trusteeId}`)}>
        Mở hộp nhận
      </Button>
    </>
  );
}
