/** Chặn các trang cần đăng nhập: chưa có phiên → hiện form đăng nhập ngay tại đây (kiểu REST API). */
import { useEffect, useState, type ReactNode } from 'react';
import { FullPageSpin, LoginForm } from '@deathnote/ui';
import type { User } from '@deathnote/api';
import { auth, GOOGLE_CLIENT_ID } from '../config';

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    auth.getUser().then((u) => setUser(u && !u.expired ? u : null));
  }, []);

  if (user === undefined) return <FullPageSpin />;
  if (!user) return <LoginForm auth={auth} onSuccess={setUser} googleClientId={GOOGLE_CLIENT_ID} />;
  return <>{children}</>;
}
