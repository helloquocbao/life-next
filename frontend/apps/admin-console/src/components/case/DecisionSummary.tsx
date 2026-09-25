/**
 * KHỐI 1 — Tóm tắt quyết định: điều người duyệt cần thấy đầu tiên.
 *
 * - Khuyến nghị do backend tính (`summary.recommendation`), KHÔNG phải quyết định — người duyệt vẫn phải đối chiếu.
 * - Màu: xanh khi đủ 4 cổng và không có cờ rủi ro Cao; đỏ khi có cờ Cao; vàng khi còn thiếu cổng.
 * - 4 cổng: Thời gian (owner im lặng đủ lâu) / Con người (đủ m-of-n đồng thuận độc lập) /
 *   Bằng chứng (đã có tài liệu) / Mật mã (mỗi người nhận có đủ mảnh khoá để tự giải mã phía client).
 */
import { Alert, Typography } from 'antd';
import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import type { RiskFlagDto } from '@deathnote/api';
import { colors } from '@deathnote/ui';
import type { DecisionSummaryDto } from '../../lib/types';

export function DecisionSummary({ summary, riskFlags }: { summary?: DecisionSummaryDto; riskFlags: RiskFlagDto[] }) {
  const hasHigh = riskFlags.some((f) => f.severity === 2);
  const allPassed = !!summary?.allGatesPassed;
  const type = allPassed && !hasHigh ? 'success' : hasHigh ? 'error' : 'warning';

  return (
    <>
      <Alert type={type} showIcon title={<Typography.Text strong>{summary?.recommendation || 'Chưa có khuyến nghị.'}</Typography.Text>}
        description="Khuyến nghị tự động dựa trên 4 cổng kiểm tra và cờ rủi ro — quyết định cuối cùng thuộc về người thẩm định."
        style={{ marginBottom: 12 }} />
      <div className="gate-grid">
        {(summary?.gates ?? []).map((g) => (
          <div key={g.code ?? g.name} className={`gate-cell ${g.passed ? 'passed' : 'failed'}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {g.passed
                ? <CheckCircleFilled style={{ color: colors.primary, fontSize: 16 }} />
                : <CloseCircleFilled style={{ color: colors.red, fontSize: 16 }} />}
              <Typography.Text strong>{g.name}</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12, marginInlineStart: 'auto' }}>{g.passed ? 'Đạt' : 'Chưa đạt'}</Typography.Text>
            </div>
            <Typography.Text style={{ fontSize: 13 }}>{g.detail}</Typography.Text>
          </div>
        ))}
      </div>
    </>
  );
}
