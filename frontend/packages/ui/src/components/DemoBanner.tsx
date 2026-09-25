import { Alert } from 'antd';
import { humanizeBusiness } from '../format';

/** Dải thông báo chế độ demo (thời gian được nén) — tránh hiểu nhầm khi trình diễn cho nhà đầu tư. */
export function DemoBanner({ timeScale }: { timeScale?: number }) {
  if (!timeScale || timeScale <= 1) return null;
  const secondsPerDay = Math.round(86400 / timeScale);
  return (
    <Alert
      type="info"
      banner
      showIcon={false}
      style={{ textAlign: 'center', fontSize: 13 }}
      title={`Chế độ trình diễn: thời gian được nén — 1 ngày ≈ ${secondsPerDay} giây (1 giờ thật ≈ ${humanizeBusiness(3600_000 * timeScale)}).`}
    />
  );
}
