import { colors } from '../theme';

/** Logo chữ + biểu tượng dấu tích (an toàn), không dùng biểu tượng tang tóc. */
export function Brand({ subtitle, size = 20 }: { subtitle?: string; size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width={size + 8} height={size + 8} viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill={colors.primary} />
        <path d="M9 17l4 4 10-10" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ lineHeight: 1.1 }}>
        <div style={{ fontWeight: 700, fontSize: size, color: colors.ink }}>LifeNext</div>
        {subtitle && <div style={{ fontSize: 12, color: colors.muted }}>{subtitle}</div>}
      </div>
    </div>
  );
}
