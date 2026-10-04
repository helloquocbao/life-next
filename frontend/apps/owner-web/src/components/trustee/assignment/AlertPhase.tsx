/**
 * Giai đoạn "Cảnh báo" — CHỈ dành cho người nhắc nhở: owner đã im lặng và đang trong thời gian ân hạn.
 *
 * Một việc duy nhất: liên lạc với owner và nhắc họ mở ứng dụng bấm "Tôi vẫn ổn". Đồng hồ đếm ngược cho thấy còn bao lâu
 * trước khi thông tin tự động được gửi cho người nhận — để người nhắc nhở biết mức độ gấp.
 */
import { useState } from 'react';
import { App, Alert, Button, Flex, Typography } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { ContactResponse, type AssignmentDto } from '@deathnote/api';
import { ErrorAlert, formatDateTime } from '@deathnote/ui';
import { useRespondContact } from '../../../lib/trusteePortalHooks';
import { useCountdown } from '../../../lib/useServerClock';

export function AlertPhase({ a }: { a: AssignmentDto }) {
  const { message } = App.useApp();
  const respond = useRespondContact();
  const [changing, setChanging] = useState(false);
  const remaining = useCountdown(a.releaseAt, a.serverNow, a.timeScale);
  const answered = a.myContactResponse !== undefined && a.myContactResponse !== null && !changing;

  const answer = (response: ContactResponse) =>
    respond.mutate(
      { trusteeId: a.trusteeId!, response },
      { onSuccess: () => { setChanging(false); message.success('Đã ghi nhận câu trả lời của bạn.'); } },
    );

  return (
    <>
      <p className="lead">
        {a.ownerName} chưa xác nhận "tôi vẫn ổn" {a.silentDays ?? '?'} ngày. Nhờ bạn liên lạc giúp.
      </p>
      {a.lastCheckInAt && (
        <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>Lần xác nhận gần nhất: {formatDateTime(a.lastCheckInAt)}</Typography.Paragraph>
      )}

      <Alert type="warning" showIcon icon={<ClockCircleOutlined />} style={{ margin: '12px 0 16px' }}
        title={remaining && !remaining.overdue
          ? `Còn khoảng ${remaining.text} trước khi thông tin tự động được gửi cho người nhận`
          : 'Sắp hết thời gian chờ — thông tin sắp tự động được gửi cho người nhận'}
        description={`Mốc dự kiến: ${formatDateTime(a.releaseAt)}. Chỉ cần ${a.ownerName} mở ứng dụng và bấm "Tôi vẫn ổn" là mọi thứ dừng lại ngay.`} />

      <Typography.Paragraph>
        <b>Bạn có thể làm gì:</b> gọi điện hoặc nhắn tin cho {a.ownerName}; nếu không được, thử qua người thân, bạn bè hoặc nơi làm việc của họ.
        Phần lớn trường hợp họ chỉ quên bấm.
      </Typography.Paragraph>

      {!answered && (
        <>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>Sau khi thử, cho chúng tôi biết kết quả:</Typography.Paragraph>
          <div className="big-actions">
            <Button type="primary" size="large" loading={respond.isPending && respond.variables?.response === ContactResponse.CanReach}
              disabled={respond.isPending} onClick={() => answer(ContactResponse.CanReach)}>Tôi liên lạc được rồi</Button>
            <Button size="large" loading={respond.isPending && respond.variables?.response === ContactResponse.CannotReach}
              disabled={respond.isPending} onClick={() => answer(ContactResponse.CannotReach)}>Tôi chưa liên lạc được</Button>
          </div>
          <ErrorAlert error={respond.error} style={{ marginTop: 12 }} />
        </>
      )}

      {answered && a.myContactResponse === ContactResponse.CanReach && (
        <Alert type="success" showIcon title="Cảm ơn bạn — thật tốt khi mọi người vẫn ổn."
          description={`Hãy nhắc ${a.ownerName} mở ứng dụng và bấm "Tôi vẫn ổn" để hệ thống trở lại bình thường. Chỉ họ mới dừng được việc gửi thông tin.`} />
      )}

      {answered && a.myContactResponse === ContactResponse.CannotReach && (
        <Alert type="warning" showIcon title="Chúng tôi đã ghi nhận."
          description="Hãy tiếp tục thử qua người thân, bạn bè hoặc nơi làm việc của họ. Bạn không cần làm gì thêm sau đó — hết thời gian chờ, hệ thống sẽ tự xử lý." />
      )}

      {answered && (
        <Flex>
          <Button type="link" style={{ paddingLeft: 0, marginTop: 8 }} onClick={() => setChanging(true)}>Thay đổi câu trả lời</Button>
        </Flex>
      )}
    </>
  );
}
