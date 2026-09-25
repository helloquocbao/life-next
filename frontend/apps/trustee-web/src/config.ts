/**
 * Cấu hình dùng chung của Trustee Web (ứng dụng cho người được uỷ quyền):
 * địa chỉ backend, đối tượng đăng nhập OIDC (client `DeathNote_Trustee`) và API client có kiểu.
 */
import { createApiClient, createAuth } from '@deathnote/api';

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:5080';

export const auth = createAuth({
  authority: API_URL,
  clientId: 'DeathNote_Trustee',
  appUrl: window.location.origin,
});

/** Mọi lời gọi API tự đính kèm access token; hết phiên → quay lại trang đăng nhập (giữ nguyên trang hiện tại). */
export const api = createApiClient(API_URL, auth.getAccessToken, () => void auth.login());

/** Giới hạn dung lượng tệp bằng chứng — khớp DeathNoteConsts.MaxEvidenceFileBytes ở backend. */
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

/** Độ dài tối thiểu của passphrase khoá cá nhân. */
export const MIN_PASSPHRASE_LENGTH = 10;
