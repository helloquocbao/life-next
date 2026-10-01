/**
 * Nộp tệp bằng chứng (multipart/form-data, field `file`).
 *
 * Dùng `fetch` trực tiếp thay vì openapi-fetch vì cần gửi FormData thô (trình duyệt tự đặt boundary).
 * Access token lấy từ phiên OIDC hiện tại; lỗi nghiệp vụ ABP được chuyển thành ApiError tiếng Việt.
 */
import { ApiError, type EvidenceBriefDto, type EvidenceKind } from '@deathnote/api';
import { API_URL, MAX_EVIDENCE_BYTES, auth } from '../config';

export async function uploadEvidence(requestId: string, kind: EvidenceKind, file: File): Promise<EvidenceBriefDto> {
  // Kiểm tra sớm phía client để khỏi tải 10MB lên rồi mới bị từ chối.
  if (file.size > MAX_EVIDENCE_BYTES) throw new ApiError('Tệp vượt quá 10 MB. Vui lòng chọn tệp nhỏ hơn.', 400);

  const token = await auth.getAccessToken();
  const form = new FormData();
  form.append('file', file, file.name);

  const url = `${API_URL}/api/app/trustee-portal/upload-evidence/${encodeURIComponent(requestId)}?kind=${kind}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Accept-Language': 'vi' },
    body: form,
  });

  if (res.status === 401) {
    void auth.logout();
    throw new ApiError('Phiên đăng nhập đã hết hạn.', 401);
  }
  if (!res.ok) {
    let message = 'Không nộp được tệp, vui lòng thử lại.';
    try {
      const body = (await res.json()) as { error?: { message?: string; code?: string } };
      if (body.error?.message) message = body.error.message;
    } catch {
      /* phản hồi không phải JSON — giữ thông báo mặc định */
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as EvidenceBriefDto;
}
