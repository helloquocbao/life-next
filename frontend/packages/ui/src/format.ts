/** Định dạng ngày giờ, dung lượng, thời lượng (tiếng Việt). */
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';
import 'dayjs/locale/vi';

dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.locale('vi');

/**
 * Backend trả thời gian UTC nhưng không kèm "Z" (Npgsql legacy timestamp). Hàm này luôn hiểu là UTC
 * rồi đổi sang giờ máy người dùng.
 */
export function parseUtc(value: string | null | undefined): dayjs.Dayjs | null {
  if (!value) return null;
  return /[zZ]|[+-]\d\d:\d\d$/.test(value) ? dayjs(value) : dayjs.utc(value).local();
}

export const formatDateTime = (v?: string | null) => parseUtc(v)?.format('HH:mm DD/MM/YYYY') ?? '—';
export const formatDate = (v?: string | null) => parseUtc(v)?.format('DD/MM/YYYY') ?? '—';
export const formatRelative = (v?: string | null) => parseUtc(v)?.fromNow() ?? '—';

export function formatBytes(bytes?: number | null): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Khoảng thời gian "nghiệp vụ" còn lại tới một mốc, có tính hệ số nén thời gian của chế độ demo.
 * Ví dụ timeScale = 2880: còn 30 giây thật ⇒ hiển thị "1 ngày".
 */
export function businessRemaining(target: string | null | undefined, serverNowOffsetMs: number, timeScale: number) {
  const t = parseUtc(target);
  if (!t) return null;
  const realMs = t.valueOf() - (Date.now() + serverNowOffsetMs);
  const businessMs = realMs * timeScale;
  return { realMs, businessMs, overdue: realMs <= 0, text: humanizeBusiness(Math.abs(businessMs)) };
}

export function humanizeBusiness(ms: number): string {
  const minutes = ms / 60000;
  const hours = minutes / 60;
  const days = hours / 24;
  if (days >= 1.5) return `${Math.round(days)} ngày`;
  if (hours >= 1) return `${Math.round(hours)} giờ`;
  if (minutes >= 1) return `${Math.round(minutes)} phút`;
  return 'vài giây';
}

export { dayjs };
