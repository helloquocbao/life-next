/**
 * Cấu hình dùng chung của Admin Console (web vận hành của PICO):
 * địa chỉ backend, đối tượng đăng nhập OIDC (client `DeathNote_Admin`) và API client có kiểu.
 *
 * Dựng theo đúng khuôn của App (Owner + Trustee) để cả hai ứng dụng có cùng cách xác thực.
 */
import { createApiClient, createAuth } from '@deathnote/api';

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:5080';

export const auth = createAuth({
  authority: API_URL,
  clientId: 'DeathNote_Admin',
  appUrl: window.location.origin,
});

/** Mọi lời gọi API tự đính kèm access token; hết phiên → quay lại trang đăng nhập. */
export const api = createApiClient(API_URL, auth.getAccessToken, () => void auth.logout());
