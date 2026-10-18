import dayjs from 'dayjs';
import { LAMPORTS_PER_SOL, type PublicKey } from '@solana/web3.js';
import { config } from '../config';

export const formatTime = (unix: number) => dayjs.unix(unix).format('HH:mm:ss DD/MM/YYYY');
export const sol = (lamports: number) => `${(lamports / LAMPORTS_PER_SOL).toLocaleString('vi-VN', { maximumFractionDigits: 4 })} SOL`;
export const short = (k: PublicKey | string) => {
  const s = typeof k === 'string' ? k : k.toBase58();
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
};

/** Khoảng thời gian còn lại, quy về "ngày" của chương trình (bản demo: 1 ngày = 4 giây). */
export function remaining(seconds: number) {
  const day = config.demoTime ? 4 : 86_400;
  if (seconds <= 0) return 'đã qua';
  const days = seconds / day;
  if (days >= 1) return `${Math.floor(days)} ngày`;
  const hours = Math.floor((seconds / day) * 24);
  return hours >= 1 ? `${hours} giờ` : 'dưới 1 giờ';
}

export function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const m = msg.match(/Error Message: ([^.]+)\./);
  if (m) return m[1];
  if (/User rejected/i.test(msg)) return 'Bạn đã huỷ trên ví.';
  return msg;
}
