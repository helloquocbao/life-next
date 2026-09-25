/**
 * Đồng hồ đồng bộ với server + nhịp render mỗi giây cho các bộ đếm ngược.
 * `offsetMs` = giờ server − giờ máy, để đếm ngược đúng dù đồng hồ máy người dùng lệch.
 */
import { useEffect, useState } from 'react';
import { parseUtc } from '@deathnote/ui';

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
