/**
 * Tải tệp bằng chứng (CCCD, giấy chứng tử…) cho người thẩm định.
 *
 * - File nhị phân cần access token nên không dùng thẻ <a href> trực tiếp: tải về Blob rồi tạo object URL.
 * - MỖI lần gọi = một bản ghi audit `release.evidence_viewed` ở backend (kể cả khi chỉ xem trước).
 * - Object URL phải được thu hồi (`URL.revokeObjectURL`) khi đóng xem trước để không rò bộ nhớ.
 */
import { downloadBlob } from '@deathnote/api';
import { API_URL, auth } from '../config';

export async function fetchEvidenceBlob(evidenceId: string): Promise<Blob> {
  const token = await auth.getAccessToken();
  return downloadBlob(API_URL, `/api/app/release-review/evidence-file/${encodeURIComponent(evidenceId)}`, token);
}

/** Loại tệp có thể xem trước ngay trong trình duyệt (ảnh hoặc PDF). */
export function previewKind(contentType: string | null | undefined): 'image' | 'pdf' | null {
  if (!contentType) return null;
  if (contentType.startsWith('image/')) return 'image';
  if (contentType === 'application/pdf') return 'pdf';
  return null;
}

/** Kích hoạt tải xuống từ Blob với tên tệp gốc, rồi thu hồi object URL. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
