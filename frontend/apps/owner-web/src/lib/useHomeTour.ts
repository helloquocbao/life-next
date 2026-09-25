/**
 * Chạy hướng dẫn sử dụng (driver.js) trên trang chủ Owner Web.
 *  - Tự động chạy MỘT LẦN cho người dùng mới (đánh dấu bằng localStorage, xem @deathnote/ui#tour).
 *  - Chạy lại bất cứ lúc nào khi người dùng bấm "Hướng dẫn sử dụng" ở menu (forceStart=true).
 */
import { useEffect, useRef } from 'react';
import { createTour, hasSeenTour, markTourSeen } from '@deathnote/ui';
import { HOME_TOUR_KEY, getHomeTourSteps } from './tour';

export function useHomeTour(args: { ready: boolean; forceStart: boolean; onForceStartConsumed: () => void }) {
  const { ready, forceStart, onForceStartConsumed } = args;
  const started = useRef(false);

  useEffect(() => {
    if (!ready || started.current) return;

    const run = () => {
      started.current = true;
      const tour = createTour(getHomeTourSteps(), { onFinish: () => markTourSeen(HOME_TOUR_KEY) });
      tour.drive();
    };

    if (forceStart) {
      onForceStartConsumed();
      // Đợi một nhịp để DOM (đặc biệt các mục điều hướng) render xong sau khi điều hướng về "/".
      const t = window.setTimeout(run, 150);
      return () => window.clearTimeout(t);
    }
    if (!hasSeenTour(HOME_TOUR_KEY)) {
      const t = window.setTimeout(run, 600);
      return () => window.clearTimeout(t);
    }
  }, [ready, forceStart, onForceStartConsumed]);
}
