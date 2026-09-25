/**
 * Xem trước tệp bằng chứng (ảnh/PDF) ngay trong console, không lưu xuống máy người duyệt.
 *
 * - Mở Modal = tải tệp qua API có token → backend ghi audit `release.evidence_viewed` cho lượt xem này.
 * - Object URL được thu hồi khi đóng Modal (giảm dấu vết giấy tờ nhạy cảm trong bộ nhớ trình duyệt).
 * - PDF hiển thị qua <iframe src="blob:…"> — index.html đã mở `frame-src blob:` trong CSP cho việc này.
 */
import { useEffect, useState } from 'react';
import { Modal, Spin, Typography } from 'antd';
import { ErrorAlert } from '@deathnote/ui';
import { fetchEvidenceBlob, previewKind } from '../../lib/evidence';
import type { CaseEvidenceDto } from '../../lib/types';

export function EvidencePreviewModal({ evidence, onClose }: { evidence: CaseEvidenceDto | null; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<unknown>();

  useEffect(() => {
    if (!evidence?.id) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    setUrl(null);
    setError(undefined);
    fetchEvidenceBlob(evidence.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((e: unknown) => !cancelled && setError(e));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [evidence?.id]);

  const kind = previewKind(evidence?.contentType);

  return (
    <Modal open={!!evidence} onCancel={onClose} footer={null} width="80%" destroyOnHidden
      title={<span>{evidence?.fileName} <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>— lượt xem này đã được ghi vào audit log</Typography.Text></span>}>
      <ErrorAlert error={error} />
      {!url && !error && <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>}
      {url && kind === 'image' && <img src={url} alt={evidence?.fileName ?? ''} className="evidence-preview-img" />}
      {url && kind === 'pdf' && <iframe src={url} title={evidence?.fileName ?? 'PDF'} className="evidence-preview" />}
    </Modal>
  );
}
