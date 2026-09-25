/**
 * KHỐI 5 — Cờ rủi ro do backend phân tích tự động (ReleaseRiskAnalyzer):
 * vd. trustee mới được thêm gần đây, các đồng thuận trùng IP, owner vừa check-in, thiếu bằng chứng…
 * Cờ mức Cao khiến khuyến nghị chuyển sang "cần xem xét kỹ".
 */
import { Tag, Typography } from 'antd';
import type { RiskFlagDto, RiskSeverity } from '@deathnote/api';
import { riskSeverityColor, riskSeverityLabel } from '@deathnote/ui';

export function RiskFlagsSection({ flags }: { flags: RiskFlagDto[] }) {
  if (!flags.length) return <Typography.Text type="secondary">Không phát hiện cờ rủi ro nào.</Typography.Text>;
  // Sắp mức độ giảm dần để cờ Cao nằm trên cùng.
  const sorted = [...flags].sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0));
  return (
    <div>
      {sorted.map((f, i) => (
        <div key={`${f.code}-${i}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderTop: i ? '1px solid #e3e8e6' : undefined }}>
          <Tag color={riskSeverityColor[(f.severity ?? 0) as RiskSeverity]} style={{ minWidth: 84, textAlign: 'center' }}>
            {riskSeverityLabel[(f.severity ?? 0) as RiskSeverity]}
          </Tag>
          <div style={{ flex: 1 }}>
            <Typography.Text>{f.message}</Typography.Text>
            {f.code && <div><Typography.Text type="secondary" className="mono">{f.code}</Typography.Text></div>}
          </div>
        </div>
      ))}
    </div>
  );
}
