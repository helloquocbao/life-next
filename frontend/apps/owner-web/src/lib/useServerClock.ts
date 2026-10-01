/**
 * Đồng hồ đồng bộ với server + nhịp render mỗi giây cho các bộ đếm ngược.
 * `offsetMs` = giờ server − giờ máy, để đếm ngược đúng dù đồng hồ máy người dùng lệch.
 */
import { useEffect, useState } from 'react';
import { businessRemaining, parseUtc } from '@deathnote/ui';

export function useServerOffset(serverNow?: string | null) {
  const server = parseUtc(serverNow);
  return server ? server.valueOf() - Date.now() : 0;
}

export function useTick(intervalMs = 1000) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => set((x) => x + 1), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
}

/** Thời gian nghiệp vụ còn lại tới một mốc; tự cập nhật mỗi giây. Dùng ở các màn trustee (đếm ngược ân hạn…). */
export function useCountdown(target: string | null | undefined, serverNow: string | undefined, timeScale: number | undefined) {
  useTick(1000);
  const offset = useServerOffset(serverNow);
  return businessRemaining(target, offset, timeScale && timeScale > 0 ? timeScale : 1);
}
