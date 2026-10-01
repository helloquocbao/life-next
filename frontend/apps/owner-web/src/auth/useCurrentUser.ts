/**
 * Hook đọc người dùng hiện tại (có thể null khi chưa đăng nhập — vd. trang lời mời công khai).
 * Tự cập nhật khi phiên được nạp/gia hạn/đăng xuất.
 */
import { useEffect, useState } from 'react';
import type { User } from '@deathnote/api';
import { auth } from '../config';

/** `undefined` = đang kiểm tra; `null` = chưa đăng nhập. */
export function useCurrentUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    auth.getUser().then((u) => alive && setUser(u && !u.expired ? u : null));
    const onLoaded = (u: User) => setUser(u);
    const onUnloaded = () => setUser(null);
    auth.manager.events.addUserLoaded(onLoaded);
    auth.manager.events.addUserUnloaded(onUnloaded);
    return () => {
      alive = false;
      auth.manager.events.removeUserLoaded(onLoaded);
      auth.manager.events.removeUserUnloaded(onUnloaded);
    };
  }, []);

  return user;
}

/** Tên hiển thị thân thiện từ claim của token. */
export function displayName(user: User | null | undefined): string {
  if (!user) return '';
  const p = user.profile;
  return (p.name as string | undefined) ?? (p.preferred_username as string | undefined) ?? (p.email as string | undefined) ?? '';
}
