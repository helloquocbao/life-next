/**
 * Giai đoạn "Cảnh báo": owner đã quá thời gian check-in và đang trong thời gian ân hạn.
 *
 * Mỗi lúc chỉ một việc:
 *   1) Hỏi "Bạn có liên lạc được không?" — chặn phần lớn báo động giả (owner chỉ quên).
 *   2) Nếu không liên lạc được: khởi tạo yêu cầu mở (khi hết ân hạn) hoặc đếm ngược tới lúc được phép.
 */
import { useState } from 'react';
import { App, Alert, Button, Flex, Typography } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { ContactResponse, ReleaseStatus, TrusteeRole, type AssignmentDto } from '@deathnote/api';
import { ErrorAlert, formatDateTime } from '@deathnote/ui';
import { RELEASE_FLOW_ENABLED } from '../../../config';
import { useRespondContact } from '../../../lib/trusteePortalHooks';
import { useCountdown } from '../../../lib/useServerClock';

export function AlertPhase({ a, onInitiate }: { a: AssignmentDto; onInitiate: () => void }) {
  const { message } = App.useApp();
  const respond = useRespondContact();
  const [changing, setChanging] = useState(false);
  const answered = a.myContactResponse !== undefined && a.myContactResponse !== null && !changing;

  const answer = (response: ContactResponse) =>
    respond.mutate(
      { trusteeId: a.trusteeId!, response },
      { onSuccess: () => { setChanging(false); message.success('Đã ghi nhận câu trả lời của bạn.'); } },
    );

  const lastRejected = a.openRequest?.status === ReleaseStatus.Rejected ? a.openRequest : undefined;

  return (
    <>
      <p className="lead">
        {a.ownerName} chưa check-in {a.silentDays ?? '?'} ngày. Bạn có liên lạc được không?
      </p>
      {a.lastCheckInAt && (
        <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>Lần check-in gần nhất: {formatDateTime(a.lastCheckInAt)}</Typography.Paragraph>
      )}

      {lastRejected && (
        <Alert type="info" showIcon style={{ marginBottom: 16 }} title="Yêu cầu mở trước đó đã bị từ chối"
          description={lastRejected.closeNote || 'PICO không chấp thuận yêu cầu trước. Bạn có thể khởi tạo lại khi có thêm thông tin.'} />
      )}

      {!answered && (
        <>
          <Typography.Paragraph>Hãy thử gọi điện hoặc nhắn tin cho {a.ownerName}. Phần lớn trường hợp họ chỉ quên check-in.</Typography.Paragraph>
          <div className="big-actions">
            <Button type="primary" size="large" loading={respond.isPending && respond.variables?.response === ContactResponse.CanReach}
              disabled={respond.isPending} onClick={() => answer(ContactResponse.CanReach)}>Tôi vẫn liên lạc được</Button>
            <Button size="large" loading={respond.isPending && respond.variables?.response === ContactResponse.CannotReach}
              disabled={respond.isPending} onClick={() => answer(ContactResponse.CannotReach)}>Tôi không liên lạc được</Button>
          </div>
          <ErrorAlert error={respond.error} style={{ marginTop: 12 }} />
        </>
      )}

      {answered && a.myContactResponse === ContactResponse.CanReach && (
        <Alert type="success" showIcon title="Cảm ơn bạn — thật tốt khi mọi người vẫn ổn."
          description={`Hãy nhắc ${a.ownerName} mở ứng dụng và bấm "Tôi vẫn ổn" để hệ thống trở lại bình thường. Bạn không cần làm gì thêm.`} />
      )}

      {answered && a.myContactResponse === ContactResponse.CannotReach && (
        <>
          <Alert type="warning" showIcon style={{ marginBottom: 16 }} title="Chúng tôi đã ghi nhận."
            description={RELEASE_FLOW_ENABLED
              ? 'Hãy tiếp tục thử liên lạc qua người thân, bạn bè hoặc nơi làm việc của họ. Nếu đến hạn vẫn không liên lạc được, bạn có thể khởi tạo yêu cầu mở.'
              : 'Hãy tiếp tục thử liên lạc qua người thân, bạn bè hoặc nơi làm việc của họ. PICO sẽ liên hệ bạn với các bước tiếp theo.'} />
          {RELEASE_FLOW_ENABLED && <InitiateBlock a={a} onInitiate={onInitiate} />}
        </>
      )}

      {answered && (
        <Button type="link" style={{ paddingLeft: 0, marginTop: 8 }} onClick={() => setChanging(true)}>Thay đổi câu trả lời</Button>
      )}
    </>
  );
}

/** Nút khởi tạo (nếu được phép) hoặc đếm ngược tới lúc hết thời gian ân hạn. */
function InitiateBlock({ a, onInitiate }: { a: AssignmentDto; onInitiate: () => void }) {
  const remaining = useCountdown(a.canInitiateFrom, a.serverNow, a.timeScale);

  if (a.role === TrusteeRole.ContentOnly)
    return (
      <Typography.Paragraph>
        Với vai trò "Chỉ nhận nội dung", bạn không cần khởi tạo yêu cầu. Những người được uỷ quyền khác sẽ xử lý và bạn sẽ được báo khi có tiến triển.
      </Typography.Paragraph>
    );

  if (a.canInitiate)
    return (
      <Flex vertical gap={8}>
        <Button type="primary" size="large" block style={{ height: 56 }} onClick={onInitiate}>Khởi tạo yêu cầu mở</Button>
        <Typography.Text type="secondary">Yêu cầu chỉ được mở khi đủ người giữ khoá đồng ý và PICO thẩm định. {a.ownerName} vẫn có thể huỷ bất cứ lúc nào.</Typography.Text>
      </Flex>
    );

  return (
    <Alert type="info" showIcon icon={<ClockCircleOutlined />}
      title={remaining && !remaining.overdue ? `Bạn có thể khởi tạo yêu cầu mở sau khoảng ${remaining.text}` : 'Sắp có thể khởi tạo yêu cầu mở — vui lòng đợi trong giây lát'}
      description={`${a.ownerName} đã chọn một khoảng thời gian ân hạn trước khi bất kỳ ai được yêu cầu mở hồ sơ — để tránh mở nhầm khi họ chỉ tạm vắng (đi xa, ốm, mất điện thoại). Mốc dự kiến: ${formatDateTime(a.canInitiateFrom)}.`} />
  );
}
