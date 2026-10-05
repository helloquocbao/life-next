/**
 * Giai đoạn "Đã bàn giao". Người nhận thông tin: một việc — mở hộp nhận. Người nhắc nhở: chỉ được báo là đã xong
 * (họ không nhận thông tin nào).
 */
import { Alert, Button, Typography } from 'antd';
import { useNavigate } from 'react-router';
import { TrusteeRole, type AssignmentDto } from '@deathnote/api';
import { formatDateTime } from '@deathnote/ui';

export function ReleasedPhase({ a }: { a: AssignmentDto }) {
  const navigate = useNavigate();

  if (a.role === TrusteeRole.Reminder)
    return (
      <>
        <p className="lead">Hồ sơ của {a.ownerName} đã được bàn giao.</p>
        <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
          Hết thời gian chờ, thông tin đã tự động được gửi cho những người nhận lúc {formatDateTime(a.releasedAt)}.
          Cảm ơn bạn đã giúp — bạn không cần làm gì thêm.
        </Typography.Paragraph>
      </>
    );

  if (!a.hasGrant)
    return (
      <>
        <p className="lead">Hồ sơ của {a.ownerName} đã được bàn giao.</p>
        <Alert type="info" showIcon style={{ marginTop: 12 }}
          title={`${a.ownerName} không để lại phần nào cho bạn trong hồ sơ này.`}
          description="Nếu bạn nghĩ đây là nhầm lẫn, hãy liên hệ những người thân khác của họ." />
      </>
    );

  return (
    <>
      <p className="lead">Phần {a.ownerName} để lại cho bạn đã sẵn sàng.</p>
      <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
        Hồ sơ được bàn giao lúc {formatDateTime(a.releasedAt)}.
        Hãy mở khi bạn sẵn sàng — không có gì phải vội.
      </Typography.Paragraph>
      <Button type="primary" size="large" block style={{ height: 60, fontSize: 18 }} onClick={() => navigate(`/inbox/${a.trusteeId}`)}>
        Mở hộp nhận
      </Button>
    </>
  );
}
