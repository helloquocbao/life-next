/**
 * Cấu hình dùng chung của App (gộp Owner + Trustee — 1 tài khoản có thể vừa là chủ két của mình,
 * vừa được người khác nhờ giữ khoá): địa chỉ backend, đối tượng đăng nhập OIDC (client `DeathNote_App`,
 * dùng chung cho cả 2 vai trò) và API client có kiểu.
 */
import { createApiClient, createAuth } from '@deathnote/api';

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:5080';

/** OAuth Client ID của Google cho SSO owner — trống thì ẩn nút. Phải trùng Authentication:Google:ClientId ở backend. */
export const GOOGLE_CLIENT_ID: string | undefined = import.meta.env.VITE_GOOGLE_CLIENT_ID || undefined;

export const auth = createAuth({
  authority: API_URL,
  clientId: 'DeathNote_App',
  appUrl: window.location.origin,
});

/** Mọi lời gọi API tự đính kèm access token; hết phiên → quay lại trang đăng nhập. */
export const api = createApiClient(API_URL, auth.getAccessToken, () => void auth.logout());

/** Độ dài tối thiểu của mật khẩu chính két (owner). */
export const MIN_PASSPHRASE_LENGTH = 10;
