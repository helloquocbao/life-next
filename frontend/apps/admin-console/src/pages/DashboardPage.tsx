/**
 * Dashboard vận hành — bức tranh tổng quát cho trưởng ca thẩm định.
 *
 * NGUYÊN TẮC: chỉ số liệu tổng hợp (đếm, tổng dung lượng), không danh tính khách hàng, không nội dung két.
 * - Hàng thẻ trên cùng: khối lượng việc của đội thẩm định (chờ duyệt, quá SLA, cần bổ sung, chờ cuối, thu đồng thuận).
 * - Phân bố trạng thái owner: thanh ngang vẽ bằng CSS (monorepo không có thư viện biểu đồ).
 * - Metadata két: tổng số hạng mục + dung lượng ciphertext — PICO không biết bên trong là gì.
 */
import { Card, Col, Row, Skeleton, Statistic, Typography } from 'antd';
import { AlertOutlined, ClockCircleOutlined, FileSearchOutlined, HourglassOutlined, TeamOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router';
import { ErrorAlert, colors, formatBytes, lifecycleStateLabel } from '@deathnote/ui';
import type { LifecycleState } from '@deathnote/api';
import { useDashboard } from '../lib/api-hooks';
import { PageTitle } from '../components/PageTitle';

/** Màu thanh theo mức độ "nóng" của trạng thái: xanh (bình thường) → hổ phách → đỏ gạch. */
const stateBarColor: Record<LifecycleState, string> = {
  0: colors.primary, 1: '#d9a73a', 2: colors.amber, 3: '#c9703a', 4: '#c45f3a', 5: colors.red, 6: '#8a969b',
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
          <h2 className="section-heading">Khối lượng thẩm định</h2>
          <div className="kpi-grid">
            {[
              { title: 'Chờ thẩm định', value: data.pendingReviews, icon: <FileSearchOutlined />, hint: 'Cần phiếu 1 hoặc phiếu 2', tone: 'warn' },
              { title: 'Quá SLA', value: data.slaOverdue, icon: <AlertOutlined />, hint: 'Ưu tiên xử lý ngay', tone: 'danger' },
              { title: 'Cần bổ sung bằng chứng', value: data.needsMoreInfo, icon: <ClockCircleOutlined />, hint: 'Đang chờ trustee nộp thêm', tone: 'warn' },
              { title: 'Đang chờ cuối', value: data.inFinalWait, icon: <HourglassOutlined />, hint: 'Owner vẫn có thể huỷ', tone: undefined },
              { title: 'Đang thu đồng thuận', value: data.awaitingConsent, icon: <TeamOutlined />, hint: 'Chưa đủ m-of-n trustee', tone: undefined },
            ].map((s) => (
              // Chỉ tô màu khi thực sự có việc — thẻ bằng 0 giữ màu trung tính để mắt không bị kéo nhầm chỗ.
              <button key={s.title} type="button" onClick={() => navigate('/queue')}
                className={'kpi-card' + ((s.value ?? 0) > 0 && s.tone ? ` ${s.tone}` : '')}>
                <div className="kpi-head">
                  <span className="kpi-label">{s.title}</span>
                  <span className="kpi-icon">{s.icon}</span>
                </div>
                <span className="kpi-value">{s.value ?? 0}</span>
                <span className="kpi-hint">{s.hint}</span>
              </button>
            ))}
          </div>

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
