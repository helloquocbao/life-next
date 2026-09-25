/**
 * Cấu hình dùng chung của Owner Web: địa chỉ backend, đối tượng đăng nhập OIDC và API client.
 */
import { createApiClient, createAuth } from '@deathnote/api';

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:5080';

export const auth = createAuth({
  authority: API_URL,
  clientId: 'DeathNote_Owner',
  appUrl: window.location.origin,
});

/** Mọi lời gọi API tự đính kèm access token; hết phiên → quay lại trang đăng nhập. */
export const api = createApiClient(API_URL, auth.getAccessToken, () => void auth.login());
