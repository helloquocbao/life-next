/**
 * Dashboard vận hành — bức tranh tổng quát của hệ thống.
 *
 * NGUYÊN TẮC: chỉ số liệu tổng hợp (đếm, tổng dung lượng), không danh tính khách hàng, không nội dung két.
 * - Phân bố trạng thái owner: thanh ngang vẽ bằng CSS (monorepo không có thư viện biểu đồ).
 * - Metadata két: tổng số hạng mục + dung lượng ciphertext — PICO không biết bên trong là gì.
 */
import { Card, Col, Row, Skeleton, Statistic, Typography } from 'antd';
import { useNavigate } from 'react-router';
import { ErrorAlert, colors, formatBytes, lifecycleStateLabel } from '@deathnote/ui';
import type { LifecycleState } from '@deathnote/api';
import { useDashboard } from '../lib/api-hooks';
import { PageTitle } from '../components/PageTitle';

/** Màu thanh theo mức độ "nóng" của trạng thái: xanh (bình thường) → hổ phách → đỏ gạch. */
const stateBarColor: Record<LifecycleState, string> = {
  0: colors.primary, 1: '#d9a73a', 2: colors.amber, 6: '#8a969b',
};

export function DashboardPage() {
  const { data, isLoading, error } = useDashboard(true);
  const navigate = useNavigate();

  const breakdown = data?.stateBreakdown ?? [];
  const maxCount = Math.max(1, ...breakdown.map((s) => s.count ?? 0));

  return (
    <>
      <PageTitle title="Tổng quan vận hành" subtitle="Chỉ số liệu tổng hợp — không hiển thị danh tính khách hàng hay nội dung két." />
      <ErrorAlert error={error} style={{ marginBottom: 16 }} />
      {isLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : data && (
        <>
          <div className="dash-grid">
            <div>
              <h2 className="section-heading">Hồ sơ owner</h2>
              <Card size="small" title="Phân bố trạng thái" extra={<Typography.Text type="secondary">{data.totalOwners ?? 0} tài khoản</Typography.Text>}>
                {breakdown.map((s) => {
                  const state = (s.state ?? 0) as LifecycleState;
                  const count = s.count ?? 0;
                  return (
                    <div key={state} className="state-bar">
                      <Typography.Text style={{ fontSize: 13 }}>{lifecycleStateLabel[state]}</Typography.Text>
                      <div className="state-bar-track">
                        {/* Độ rộng tính theo trạng thái nhiều nhất để các thanh nhỏ vẫn nhìn thấy được */}
                        <div className="state-bar-fill" style={{ width: `${(count / maxCount) * 100}%`, background: stateBarColor[state] }} />
                      </div>
                      <Typography.Text strong style={{ textAlign: 'right' }}>{count}</Typography.Text>
                    </div>
                  );
                })}
              </Card>
            </div>
            <div className="dash-side">
              <h2 className="section-heading" style={{ marginBottom: -2 }}>Hệ thống</h2>
              <Card size="small" title="Két dữ liệu" extra={<Typography.Text type="secondary">chỉ metadata</Typography.Text>}>
                <Row gutter={12}>
                  <Col span={12}><Statistic title="Tổng hạng mục" value={data.totalVaultItems ?? 0} /></Col>
                  <Col span={12}><Statistic title="Tổng dung lượng mã hoá" value={formatBytes(data.totalVaultBytes)} /></Col>
                </Row>
                <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: '12px 0 0' }}>
                  Server chỉ lưu ciphertext — PICO không biết và không thể xem nội dung các hạng mục.
                </Typography.Paragraph>
              </Card>
              <Card size="small" title="Audit log" extra={<Typography.Link onClick={() => navigate('/audit')}>Xem nhật ký</Typography.Link>}>
                <Statistic title="Sự kiện ghi nhận trong 24 giờ qua" value={data.auditEvents24h ?? 0} />
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}
