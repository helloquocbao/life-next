/**
 * Vòng tròn đếm ngược tới lần check-in kế tiếp — tầng 1 của Home.
 * Theo đúng vòng tiến độ trong mockup UI: nét mảnh 9px, số lớn dùng font serif Lora.
 * Màu: xanh (ổn) / hổ phách (quá hạn) / đỏ (đang báo người thân trở đi).
 */
import { fontSerif } from '@deathnote/ui';

export function StatusRing({ fraction, color, big, small }: { fraction: number; color: string; big: string; small: string }) {
  const r = 90;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fraction));
  return (
    <svg width="200" height="200" viewBox="0 0 200 200" role="img" aria-label={`${big} ${small}`}>
      <circle cx="100" cy="100" r={r} stroke="#E7E2D6" strokeWidth="9" fill="none" />
      <circle cx="100" cy="100" r={r} stroke={color} strokeWidth="9" fill="none" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - f)} transform="rotate(-90 100 100)"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      <text x="100" y="98" textAnchor="middle" fontSize="34" fontWeight="600" fontFamily={fontSerif} fill="#1C1C1A">{big}</text>
      <text x="100" y="122" textAnchor="middle" fontSize="12.5" fill="#5E5B54">{small}</text>
    </svg>
  );
}
