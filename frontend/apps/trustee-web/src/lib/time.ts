/**
 * Đồng hồ nghiệp vụ phía client: bù lệch giờ server và hệ số nén thời gian của chế độ demo
 * (1 ngày ≈ 30 giây). Mọi đếm ngược trong app đều đi qua đây.
 */
import { useEffect, useMemo, useState } from 'react';
import { businessRemaining, parseUtc } from '@deathnote/ui';

/** Buộc component render lại mỗi `intervalMs` (dùng cho đếm ngược). */
export function useTick(intervalMs = 1000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setN((n) => n + 1), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
}

/** Độ lệch (ms) giữa giờ server và giờ máy người dùng, tính tại thời điểm nhận dữ liệu. */
export function useServerOffset(serverNow: string | undefined): number {
  return useMemo(() => {
    const s = parseUtc(serverNow);
    return s ? s.valueOf() - Date.now() : 0;
  }, [serverNow]);
}

/** Thời gian nghiệp vụ còn lại tới một mốc; tự cập nhật mỗi giây. */
export function useCountdown(target: string | null | undefined, serverNow: string | undefined, timeScale: number | undefined) {
  useTick(1000);
  const offset = useServerOffset(serverNow);
  return businessRemaining(target, offset, timeScale && timeScale > 0 ? timeScale : 1);
}
