/**
 * Đăng nhập OpenID Connect (Authorization Code + PKCE) với máy chủ xác thực của backend (OpenIddict).
 *
 * - Trang đăng nhập/đăng ký nằm ở backend → SPA không bao giờ chạm vào mật khẩu người dùng.
 * - Token lưu trong sessionStorage (mất khi đóng tab) — phù hợp dữ liệu nhạy cảm.
 * - Mỗi app có client_id riêng: DeathNote_Owner / DeathNote_Trustee / DeathNote_Admin.
 */
import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';

export type AuthConfig = {
  /** Địa chỉ backend, vd. http://localhost:5080 */
  authority: string;
  clientId: 'DeathNote_Owner' | 'DeathNote_Trustee' | 'DeathNote_Admin';
  /** Gốc của SPA, vd. http://localhost:5173 */
  appUrl: string;
};

export type Auth = ReturnType<typeof createAuth>;

export function createAuth(config: AuthConfig) {
  const manager = new UserManager({
    authority: config.authority,
    client_id: config.clientId,
    redirect_uri: `${config.appUrl}/auth/callback`,
    post_logout_redirect_uri: config.appUrl,
    response_type: 'code',
    scope: 'openid profile email phone roles offline_access DeathNote',
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    automaticSilentRenew: true,
    loadUserInfo: false,
  });

  return {
    manager,
    /** Chuyển tới trang đăng nhập; `returnTo` là đường dẫn quay lại sau khi đăng nhập. */
    login: (returnTo?: string) => manager.signinRedirect({ state: { returnTo: returnTo ?? window.location.pathname + window.location.search } }),
    /** Mở thẳng trang đăng ký tài khoản của backend. */
    register: (returnTo?: string) =>
      manager.signinRedirect({ state: { returnTo: returnTo ?? '/' }, extraQueryParams: { prompt: 'create' } }),
    logout: () => manager.signoutRedirect(),
    /** Xử lý redirect về /auth/callback; trả về đường dẫn cần quay lại. */
    async handleCallback(): Promise<string> {
      const user = await manager.signinRedirectCallback();
      return ((user.state as { returnTo?: string } | undefined)?.returnTo) ?? '/';
    },
    getUser: (): Promise<User | null> => manager.getUser(),
    async getAccessToken(): Promise<string | null> {
      const user = await manager.getUser();
      return user && !user.expired ? user.access_token : null;
    },
  };
}

export type { User };
