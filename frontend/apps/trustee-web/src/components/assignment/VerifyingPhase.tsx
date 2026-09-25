/**
 * Giai đoạn "Đang xác minh" — MÀN HÌNH QUAN TRỌNG NHẤT với người thân:
 *   - Tiến độ đồng thuận trực quan (vòng tròn lớn + ai đã đồng ý, lúc nào).
 *   - Nút "Tôi đồng ý mở" (nếu mình là người giữ khoá và chưa đồng ý).
 *   - Các bước của hồ sơ + mốc dự kiến.
 *   - Bằng chứng (nộp thêm / gửi lại khi PICO yêu cầu).
 */
import { useState } from 'react';
import { Alert, Button, Divider, Typography } from 'antd';
import { ReleaseStatus, type AssignmentDto, type KeyringDto } from '@deathnote/api';
import { releaseReasonLabel } from '@deathnote/ui';
import { useCountdown } from '../../lib/time';
import { ConsentModal } from './ConsentModal';
import { ConsentProgress } from './ConsentProgress';
import { EvidenceSection } from './EvidenceSection';
import { ReleaseSteps } from './ReleaseSteps';

export function VerifyingPhase({ a, keyring }: { a: AssignmentDto; keyring: KeyringDto | undefined }) {
  const [consentOpen, setConsentOpen] = useState(false);
  const r = a.openRequest;
  const finalLeft = useCountdown(r?.finalWaitUntil, a.serverNow, a.timeScale);

  if (!r)
    return <p className="lead">Hồ sơ của {a.ownerName} đang được xác minh. Bạn sẽ được thông báo khi có tiến triển.</p>;

  return (
    <>
      {r.status === ReleaseStatus.FinalWait && (
        <Alert type="info" showIcon style={{ marginBottom: 20 }}
          title={`Thời gian chờ cuối: còn khoảng ${finalLeft?.overdue ? 'vài giây' : finalLeft?.text ?? '—'}`}
          description={`${a.ownerName} vẫn còn quyền huỷ trong thời gian này. Sau đó hồ sơ sẽ được mở và bạn có thể mở hộp nhận.`} />
      )}
      {r.status === ReleaseStatus.Rejected && (
        <Alert type="error" showIcon style={{ marginBottom: 20 }} title="Yêu cầu mở đã bị từ chối"
          description={r.closeNote || 'PICO không chấp thuận yêu cầu này.'} />
      )}

      <ConsentProgress r={r} />

      {r.canIConsent && (
        <>
          <Button type="primary" size="large" block style={{ height: 60, fontSize: 18, marginTop: 24 }} onClick={() => setConsentOpen(true)}>
            Tôi đồng ý mở
          </Button>
          <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
            Bạn sẽ cần passphrase khoá cá nhân. Đồng ý = chuyển mảnh khoá (đã niêm phong) cho người thân khác; PICO không đọc được.
          </Typography.Paragraph>
          {r.id && (
            <ConsentModal requestId={r.id} ownerName={a.ownerName ?? ''} keyring={keyring}
              open={consentOpen} onClose={() => setConsentOpen(false)} />
          )}
        </>
      )}

      <Divider />
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
        Lý do: {r.reason !== undefined ? releaseReasonLabel[r.reason] : '—'}
        {r.statement ? ` — "${r.statement}"` : ''}
      </Typography.Paragraph>
      <ReleaseSteps r={r} a={a} />

      <Divider />
      <EvidenceSection r={r} role={a.role} />
    </>
  );
}
