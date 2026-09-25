/**
 * Chặn các trang cần đăng nhập: chưa có phiên → chuyển tới trang đăng nhập của backend (OIDC).
 * Mật khẩu admin chỉ nhập trên trang của máy chủ xác thực — SPA không bao giờ chạm tới.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { FullPageSpin } from '@deathnote/ui';
import type { User } from '@deathnote/api';
import { auth } from '../config';

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    auth.getUser().then((u) => {
      if (!u || u.expired) void auth.login();
      else setUser(u);
    });
  }, []);

  if (!user) return <FullPageSpin tip="Đang chuyển tới trang đăng nhập…" />;
  return <>{children}</>;
}
