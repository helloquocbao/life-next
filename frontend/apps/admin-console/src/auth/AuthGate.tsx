/**
 * Chặn các trang cần đăng nhập: chưa có phiên → hiện form đăng nhập ngay tại đây (kiểu REST API).
 * Không cho tự đăng ký: tài khoản vận hành do quản trị cấp, tài khoản tự tạo không có vai trò admin.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { FullPageSpin, LoginForm } from '@deathnote/ui';
import type { User } from '@deathnote/api';
import { auth } from '../config';

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    auth.getUser().then((u) => setUser(u && !u.expired ? u : null));
  }, []);

  if (user === undefined) return <FullPageSpin />;
  if (!user) return <LoginForm auth={auth} onSuccess={setUser} allowRegister={false} />;
  return <>{children}</>;
}
