import { colors } from '../theme';

/**
 * Logo chữ + biểu tượng dấu tích (an toàn), không dùng biểu tượng tang tóc.
 * `inverted`: chữ sáng để đặt trên nền tối (sidebar Admin console). `markOnly`: chỉ biểu tượng (sidebar thu gọn).
 */
export function Brand({ subtitle, size = 20, inverted = false, markOnly = false }: { subtitle?: string; size?: number; inverted?: boolean; markOnly?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width={size + 8} height={size + 8} viewBox="0 0 32 32" aria-hidden style={{ flexShrink: 0 }}>
        <rect width="32" height="32" rx="8" fill={colors.primary} />
        <path d="M9 17l4 4 10-10" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!markOnly && <div style={{ lineHeight: 1.15, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: size, color: inverted ? '#ffffff' : colors.ink, whiteSpace: 'nowrap' }}>Death Note</div>
        {subtitle && <div style={{ fontSize: 12, color: inverted ? colors.adminSiderMuted : colors.muted, whiteSpace: 'nowrap' }}>{subtitle}</div>}
      </div>}
    </div>
  );
}
