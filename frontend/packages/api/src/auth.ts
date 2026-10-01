/**
 * Xác thực kiểu REST API thuần — SPA gọi thẳng backend, không chuyển trang sang server xác thực:
 *
 *   - Đăng nhập: POST /connect/token (grant_type=password) → nhận access/refresh token.
 *   - SSO Google (chỉ owner): Google Identity Services trả ID token → POST /connect/token
 *     (grant_type=google, id_token=…) — backend tự kiểm với Google rồi phát token như trên.
 *   - Đăng ký:   POST /api/account/register (API có sẵn của ABP Account) → rồi tự đăng nhập luôn.
 *   - Đăng xuất: xoá phiên ngay trên trình duyệt.
 *
 * `oidc-client-ts` chỉ còn dùng để lưu phiên (sessionStorage — mất khi đóng tab) và tự gia hạn token
 * bằng refresh token; không còn luồng redirect nào.
 * client_id: DeathNote_App (dùng chung cho owner + trustee) / DeathNote_Admin.
 */
import { User, UserManager, WebStorageStateStore, type UserProfile } from 'oidc-client-ts';

export type AuthConfig = {
  /** Địa chỉ backend, vd. http://localhost:5080 */
  authority: string;
  clientId: 'DeathNote_App' | 'DeathNote_Admin';
  /** Gốc của SPA, vd. http://localhost:5173 */
  appUrl: string;
};

export type RegisterInput = { userName: string; email: string; password: string };

const SCOPE = 'openid profile email phone roles offline_access DeathNote';

export type Auth = ReturnType<typeof createAuth>;

export function createAuth(config: AuthConfig) {
  const manager = new UserManager({
    authority: config.authority,
    client_id: config.clientId,
    // Bắt buộc theo kiểu của UserManager nhưng không dùng — không còn luồng redirect nào.
    redirect_uri: config.appUrl,
    scope: SCOPE,
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    automaticSilentRenew: true,
    loadUserInfo: false,
  });

  /** Đổi grant lấy token tại /connect/token rồi lưu thành phiên đăng nhập. */
  async function requestToken(params: Record<string, string>, fallbackError: string, fallbackName: string): Promise<User> {
    const res = await fetch(`${config.authority}/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept-Language': 'vi' },
      body: new URLSearchParams({ ...params, client_id: config.clientId, scope: SCOPE }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error_description || data.error || fallbackError);

    // Không có id_token thì chỉ cần vài claim tối thiểu để hiện tên — profile không dùng để xác thực.
    const profile = (data.id_token ? decodeJwtPayload(data.id_token) : { sub: fallbackName, preferred_username: fallbackName }) as unknown as UserProfile;
    const user = new User({
      id_token: data.id_token,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      scope: data.scope,
      profile,
      expires_at: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    });
    await manager.storeUser(user);
    await manager.events.load(user);
    return user;
  }

  const loginWithPassword = (username: string, password: string): Promise<User> =>
    requestToken({ grant_type: 'password', username, password }, 'Sai tên đăng nhập hoặc mật khẩu.', username);

  /** SSO Google: `idToken` là "credential" do Google Identity Services trả về. */
  const loginWithGoogle = (idToken: string): Promise<User> =>
    requestToken({ grant_type: 'google', id_token: idToken }, 'Không đăng nhập được bằng Google.', 'google');

  return {
    manager,
    loginWithPassword,
    loginWithGoogle,
    /** Tạo tài khoản mới rồi đăng nhập luôn bằng chính thông tin vừa nhập. */
    async registerAccount(input: RegisterInput): Promise<User> {
      const res = await fetch(`${config.authority}/api/account/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept-Language': 'vi' },
        body: JSON.stringify({ userName: input.userName, emailAddress: input.email, password: input.password, appName: 'Death Note' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || 'Không tạo được tài khoản.');
      }
      return loginWithPassword(input.userName, input.password);
    },
    /** Xoá phiên trên trình duyệt rồi tải lại trang — AuthGate sẽ hiện lại form đăng nhập. */
    async logout() {
      await manager.removeUser();
      window.location.assign(config.appUrl);
    },
    getUser: (): Promise<User | null> => manager.getUser(),
    async getAccessToken(): Promise<string | null> {
      const user = await manager.getUser();
      return user && !user.expired ? user.access_token : null;
    },
  };
}

/** Giải mã phần payload của JWT (base64url, an toàn với UTF-8) — chỉ đọc claim hiển thị, không xác thực chữ ký. */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(
    atob(base64).split('').map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
  );
  return JSON.parse(json);
}

export type { User };
