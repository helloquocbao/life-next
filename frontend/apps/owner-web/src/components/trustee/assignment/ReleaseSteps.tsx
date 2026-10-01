/**
 * Các bước của hồ sơ mở: Đang chờ đồng thuận → Đang thẩm định → Thời gian chờ cuối → Đã mở / Từ chối.
 * Mỗi bước kèm một câu giải thích và mốc dự kiến — người thân luôn biết "đang ở đâu, còn bao lâu".
 */
import { Steps } from 'antd';
import { ReleaseStatus, type AssignmentDto, type ReleaseProgressDto } from '@deathnote/api';
import { formatDateTime } from '@deathnote/ui';
import { useCountdown } from '../../../lib/useServerClock';

type StepStatus = 'wait' | 'process' | 'finish' | 'error';

/** Chỉ số bước hiện tại theo trạng thái hồ sơ. */
function currentIndex(s: ReleaseStatus | undefined): number {
  switch (s) {
    case ReleaseStatus.AwaitingConsent: return 0;
    case ReleaseStatus.AwaitingFirstReview:
    case ReleaseStatus.AwaitingSecondReview:
    case ReleaseStatus.NeedsMoreInfo: return 1;
    case ReleaseStatus.FinalWait: return 2;
    default: return 3; // Released / Rejected / CancelledByOwner
  }
}

export function ReleaseSteps({ r, a }: { r: ReleaseProgressDto; a: AssignmentDto }) {
  const idx = currentIndex(r.status);
  const finalLeft = useCountdown(r.finalWaitUntil, a.serverNow, a.timeScale);
  const st = (i: number): StepStatus => (i < idx ? 'finish' : i === idx ? 'process' : 'wait');

  const reviewText =
    r.status === ReleaseStatus.NeedsMoreInfo ? 'PICO cần bạn bổ sung bằng chứng — xem hướng dẫn bên dưới.' :
    r.status === ReleaseStatus.AwaitingSecondReview ? 'Đã có phiếu thẩm định thứ nhất, đang chờ phiếu thứ hai.' :
    'Hai người của PICO kiểm tra bằng chứng độc lập (2 phiếu). Dự kiến trong 1–2 ngày làm việc.';

  const finalText =
    r.status === ReleaseStatus.FinalWait
      ? `Còn khoảng ${finalLeft?.overdue ? 'vài giây' : finalLeft?.text ?? '—'} (tới ${formatDateTime(r.finalWaitUntil)}). ${a.ownerName} vẫn còn quyền huỷ trong thời gian này.`
      : 'Chờ thêm 48–72 giờ sau khi thẩm định xong — cơ hội cuối để người uỷ quyền huỷ nếu họ vẫn ổn.';

  const last =
    r.status === ReleaseStatus.Rejected ? { title: 'Từ chối', description: r.closeNote || 'PICO không chấp thuận yêu cầu này.', status: 'error' as StepStatus } :
    r.status === ReleaseStatus.CancelledByOwner ? { title: 'Người uỷ quyền đã huỷ', description: `${a.ownerName} đã huỷ yêu cầu — họ vẫn ổn.`, status: 'finish' as StepStatus } :
    r.status === ReleaseStatus.Released ? { title: 'Đã mở', description: `Mở lúc ${formatDateTime(r.releasedAt)}. Bạn có thể mở hộp nhận.`, status: 'finish' as StepStatus } :
    { title: 'Đã mở', description: 'Bạn nhập passphrase để mở phần được giao ngay trên trình duyệt.', status: 'wait' as StepStatus };

  return (
    <Steps
      orientation="vertical"
      size="small"
      current={idx}
      items={[
        { title: 'Đang chờ đồng thuận', status: st(0),
          content: `Cần đủ ${r.requiredConsents ?? '?'} người giữ khoá đồng ý. Bắt đầu lúc ${formatDateTime(r.initiatedAt)} bởi ${r.initiatorName ?? '—'}.` },
        { title: 'Đang thẩm định', status: r.status === ReleaseStatus.NeedsMoreInfo ? 'error' : st(1), content: reviewText },
        { title: 'Thời gian chờ cuối', status: st(2), content: finalText },
        { title: last.title, status: last.status, content: last.description },
      ]}
    />
  );
}
