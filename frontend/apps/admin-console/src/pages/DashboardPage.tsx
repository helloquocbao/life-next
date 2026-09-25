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
      <PageTitle title="Dashboard" subtitle="Chỉ số liệu tổng hợp, không danh tính." />
      <ErrorAlert error={error} style={{ marginBottom: 16 }} />
      {isLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : data && (
        <>
          <Row gutter={[12, 12]}>
            {[
              { title: 'Hồ sơ chờ thẩm định', value: data.pendingReviews, icon: <FileSearchOutlined />, color: undefined },
              { title: 'Quá SLA', value: data.slaOverdue, icon: <AlertOutlined />, color: (data.slaOverdue ?? 0) > 0 ? colors.red : undefined },
              { title: 'Cần bổ sung bằng chứng', value: data.needsMoreInfo, icon: <ClockCircleOutlined />, color: undefined },
              { title: 'Đang chờ cuối', value: data.inFinalWait, icon: <HourglassOutlined />, color: undefined },
              { title: 'Đang thu đồng thuận', value: data.awaitingConsent, icon: <TeamOutlined />, color: undefined },
            ].map((s) => (
              <Col key={s.title} flex="1 1 180px">
                <Card size="small" hoverable onClick={() => navigate('/queue')}>
                  <Statistic title={s.title} value={s.value ?? 0} prefix={s.icon} styles={{ content: { color: s.color, fontWeight: 600 } }} />
                </Card>
              </Col>
            ))}
          </Row>

          <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
            <Col xs={24} lg={14}>
              <Card size="small" title={`Phân bố trạng thái owner (${data.totalOwners ?? 0} tài khoản)`}>
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
            </Col>
            <Col xs={24} lg={10}>
              <Card size="small" title="Két dữ liệu (chỉ metadata)">
                <Row gutter={12}>
                  <Col span={12}><Statistic title="Tổng hạng mục" value={data.totalVaultItems ?? 0} /></Col>
                  <Col span={12}><Statistic title="Tổng dung lượng mã hoá" value={formatBytes(data.totalVaultBytes)} /></Col>
                </Row>
                <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: '12px 0 0' }}>
                  Server chỉ lưu ciphertext — PICO không biết và không thể xem nội dung các hạng mục.
                </Typography.Paragraph>
              </Card>
              <Card size="small" title="Audit log" style={{ marginTop: 12 }}>
                <Statistic title="Sự kiện ghi nhận trong 24 giờ qua" value={data.auditEvents24h ?? 0} />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </>
  );
}
