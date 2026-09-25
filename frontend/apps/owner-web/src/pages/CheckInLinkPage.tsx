/**
 * Check-in một chạm từ link trong email/SMS — KHÔNG cần đăng nhập, KHÔNG cần mở app.
 * (Tài liệu: "Không mở app ≠ không phản hồi".) Link dùng một lần và hết hạn khi có lần nhắc mới.
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Result } from 'antd';
import { unwrap, type CheckInByLinkResultDto } from '@deathnote/api';
import { Brand, FullPageSpin, errorMessage, formatDateTime } from '@deathnote/ui';
import { api } from '../config';

export function CheckInLinkPage() {
  const [params] = useSearchParams();
  const [result, setResult] = useState<CheckInByLinkResultDto>();
  const [error, setError] = useState<unknown>();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const token = params.get('token') ?? '';
    unwrap(api.POST('/api/app/owner/check-in-by-link', { body: { token } })).then(setResult).catch(setError);
  }, [params]);

  return (
    <div className="page-narrow" style={{ paddingTop: 48 }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}><Brand /></div>
      {!result && !error && <FullPageSpin tip="Đang xác nhận…" />}
      {result && (
        <Result status="success"
          title={`Cảm ơn ${result.displayName} — bạn đang ổn.`}
          subTitle={
            (result.wasVeto ? 'Toàn bộ tiến trình cảnh báo đã được huỷ và người thân của bạn đã được thông báo. ' : '') +
            `Lần check-in tiếp theo: ${formatDateTime(result.nextCheckInDueAt)}.`
          } />
      )}
      {error !== undefined && (
        <Result status="warning" title="Không xác nhận được" subTitle={`${errorMessage(error)} Hãy đăng nhập để check-in trực tiếp.`} />
      )}
    </div>
  );
}
