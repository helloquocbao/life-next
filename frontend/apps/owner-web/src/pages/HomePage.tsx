/**
 * HOME — màn hình trạng thái, trả lời MỘT câu hỏi: "Bạn đang ổn. Lần check-in tiếp theo: 12 ngày nữa."
 *
 * Thiết kế cho người KHÔNG rành công nghệ: chỉ MỘT khối chính đập vào mắt (trạng thái + nút bấm).
 * Số liệu, phần trăm và các chi tiết kỹ thuật được gấp lại phía dưới —
 * ai cần xem thì bấm "Xem thêm", còn lại không phải nhìn thấy ngay.
 *
 * Khi hồ sơ đã vào giai đoạn cảnh báo, Home đổi hẳn: banner đỏ + nút huỷ ngay.
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Alert, Button, Card, Col, Flex, Progress, Row, Space, Statistic, Typography } from 'antd';
import { ArrowRightOutlined, BarChartOutlined, DownOutlined, ExperimentOutlined } from '@ant-design/icons';
import { LifecycleState, type OwnerStatusDto } from '@deathnote/api';
import {
  ErrorAlert, FullPageSpin, SplitRow, businessRemaining, colors, formatDateTime, formatRelative, parseUtc,
} from '@deathnote/ui';
import { CheckInButton } from '../components/CheckInButton';
import { StatusRing } from '../components/StatusRing';
import { useOwnerStatus } from '../lib/api-hooks';
import { useServerOffset, useTick } from '../lib/useServerClock';
import { useHomeTour } from '../lib/useHomeTour';

/** Việc nên làm tiếp → trang tương ứng, viết lại bằng ngôn ngữ đời thường (không thuật ngữ kỹ thuật). */
const NEXT_ACTION_LINK: Record<string, { to: string; cta: string; plain: string }> = {
  vault: { to: '/vault', cta: 'Bắt đầu', plain: 'Tạo hộp thông tin của bạn' },
  recovery_kit: { to: '/settings?tab=security', cta: 'Xác nhận', plain: 'Xác nhận bạn đã cất bản dự phòng an toàn' },
  first_item: { to: '/vault', cta: 'Thêm ngay', plain: 'Cất thông tin đầu tiên của bạn' },
  five_items: { to: '/assets', cta: 'Trả lời vài câu hỏi', plain: 'Cho chúng tôi biết thêm về tài sản của bạn' },
  reminder: { to: '/recipients', cta: 'Thêm người', plain: 'Chọn người sẽ nhắc bạn bấm "Tôi vẫn ổn"' },
  recipient: { to: '/recipients', cta: 'Mời họ', plain: 'Mời người sẽ nhận thông tin của bạn' },
  keys: { to: '/recipients', cta: 'Chọn thông tin', plain: 'Chọn thông tin cho từng người nhận' },
  two_factor: { to: '/settings?tab=security', cta: 'Bật ngay', plain: 'Thêm một lớp bảo vệ khi xác nhận' },
};

export function HomePage() {
  const { data: s, isLoading, error } = useOwnerStatus();
  const offset = useServerOffset(s?.serverNow);
  const [searchParams, setSearchParams] = useSearchParams();
  const [detailsOpen, setDetailsOpen] = useState(false);
  useTick(1000);
  // Chạy hướng dẫn sử dụng: tự động cho người mới, hoặc khi bấm "Hướng dẫn sử dụng" ở menu (?tour=1).
  useHomeTour({ ready: !isLoading && !!s, forceStart: searchParams.get('tour') === '1', onForceStartConsumed: () => setSearchParams({}, { replace: true }) });

  if (isLoading) return <FullPageSpin />;
  if (error || !s) return <div className="page"><ErrorAlert error={error} /></div>;

  const scale = s.timeScale ?? 1;
  const due = businessRemaining(s.nextCheckInDueAt, offset, scale);
  const intervalMs = (s.checkInIntervalDays ?? 30) * 86400_000;
  const fraction = due ? Math.max(0, due.businessMs) / intervalMs : 0;
  const state = s.state ?? LifecycleState.Active;
  const alarming = state >= LifecycleState.Grace;
  const ringColor = state === LifecycleState.Active ? colors.primary : state === LifecycleState.Missed ? colors.amber : colors.red;

  const headline =
    state === LifecycleState.Active ? 'Bạn đang ổn.' :
    state === LifecycleState.Released ? 'Hồ sơ đã được bàn giao.' :
    // Missed/Grace/Verifying…: banner phía trên đã giải thích chuyện gì đang xảy ra — ở đây chỉ hỏi đúng
    // một câu để dẫn tới MỘT nút bấm, tránh nói lại cùng một thông điệp hai lần.
    'Bạn vẫn ổn chứ?';

  const next = s.readiness?.nextActionCode ? NEXT_ACTION_LINK[s.readiness.nextActionCode] : undefined;

  return (
    <div className="page-narrow">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <AlertBanner s={s} offset={offset} scale={scale} />

        {/* ---------- Khối chính: MỘT câu trả lời duy nhất ---------- */}
        <Card data-tour="status-ring">
          <Flex vertical align="center" gap={12} style={{ padding: '12px 0' }}>
            <Typography.Title level={2} style={{ margin: 0, color: alarming ? colors.red : colors.ink, textAlign: 'center' }}>{headline}</Typography.Title>
            {state !== LifecycleState.Released && (
              <>
                <StatusRing fraction={state === LifecycleState.Active ? fraction : 1} color={ringColor}
                  big={due ? (due.overdue ? `+${due.text}` : due.text) : '—'}
                  small={due?.overdue ? 'đã quá hạn' : 'đến lần xác nhận tiếp theo'} />
                <span data-tour="checkin-button">
                  <CheckInButton danger={alarming}
                    label={state === LifecycleState.Active ? 'Tôi vẫn ổn' : 'Tôi vẫn ổn — huỷ ngay'} />
                </span>
                <Typography.Text type="secondary" style={{ textAlign: 'center' }}>
                  Lần xác nhận gần nhất: {formatRelative(s.lastCheckInAt)}
                </Typography.Text>
              </>
            )}
          </Flex>
        </Card>

        {/* ---------- Việc tiếp theo: MỘT câu, MỘT nút — không thanh phần trăm, không con số ---------- */}
        {/* Luôn render (kể cả khi Released) để hướng dẫn sử dụng luôn có mục tiêu để chỉ vào. */}
        <div data-tour="next-action">
          {state !== LifecycleState.Released && (next ? (
            <Card styles={{ body: { padding: 20 } }} style={{ borderColor: colors.primary, borderWidth: 1.5 }}>
              <SplitRow align="center" gap={16}
                left={<>
                  <div className="eyebrow">Việc tiếp theo</div>
                  <Typography.Text strong style={{ fontSize: 17, display: 'block', marginTop: 4 }}>{next.plain}</Typography.Text>
                </>}
                right={<Link to={next.to}><Button type="primary" size="large" icon={<ArrowRightOutlined />}>{next.cta}</Button></Link>} />
            </Card>
          ) : (
            <Alert type="success" showIcon title="Hồ sơ của bạn đã sẵn sàng — không có việc gì cần làm thêm." />
          ))}
        </div>

        {/* ---------- Chi tiết & số liệu — gấp lại mặc định, không làm rối màn hình chính ---------- */}
        <Card data-tour="more-details" styles={{ body: { padding: 0 } }}>
          <button type="button" onClick={() => setDetailsOpen((v) => !v)}
            style={{
              all: 'unset', display: 'flex', alignItems: 'center', gap: 12, width: '100%', cursor: 'pointer',
              padding: '16px 22px', boxSizing: 'border-box',
            }}>
            <span style={{
              width: 32, height: 32, borderRadius: 10, background: colors.primarySoft,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <BarChartOutlined style={{ fontSize: 16, color: colors.primary }} />
            </span>
            <span style={{ flexGrow: 1, fontSize: 15, fontWeight: 500, color: colors.ink }}>
              {detailsOpen ? 'Ẩn bớt chi tiết' : 'Xem thêm chi tiết'}
            </span>
            <DownOutlined style={{ fontSize: 12, color: colors.mutedSoft, transition: 'transform 0.2s', transform: detailsOpen ? 'rotate(180deg)' : 'none' }} />
          </button>

          {detailsOpen && (
            <div style={{ borderTop: `1px solid ${colors.line}`, padding: 20 }}>
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <Card size="small" style={{ height: '100%' }}>
                      <div className="eyebrow">Mức độ hoàn tất</div>
                      <Progress percent={s.readiness?.score ?? 0} strokeColor={colors.primary} trailColor="#EDE8DC" size={['100%', 10]} style={{ marginTop: 12 }} />
                    </Card>
                  </Col>
                  <Col xs={24} md={12}>
                    <Card size="small" style={{ height: '100%' }}>
                      <div className="eyebrow">Tóm tắt</div>
                      <Row gutter={16}>
                        <Col span={12}><Statistic title="Thông tin đã lưu" value={s.itemCount ?? 0} /></Col>
                        <Col span={12}><Statistic title="Người thân" value={`${s.confirmedTrusteeCount ?? 0}/${s.trusteeCount ?? 0}`} /></Col>
                      </Row>
                      <div className="muted" style={{ marginTop: 12, fontSize: 13 }}>
                        Cập nhật gần nhất: {s.lastVaultUpdateAt ? formatRelative(s.lastVaultUpdateAt) : '—'}
                        {s.keysOutdated && <><br />⚠ Danh sách người nhận vừa thay đổi — hãy vào mục Người nhận để cập nhật.</>}
                      </div>
                    </Card>
                  </Col>
                </Row>
                <Card size="small">
                  <SplitRow align="center" gap={12}
                    left={
                      <Space>
                        <ExperimentOutlined style={{ fontSize: 22, color: colors.primary }} />
                        <div>
                          <b>Xem thử điều gì sẽ xảy ra</b>
                          <div className="muted" style={{ fontSize: 13 }}>Không ai bị thông báo — chỉ là một bản xem trước dành cho bạn.</div>
                        </div>
                      </Space>
                    }
                    right={<Link to="/dry-run"><Button>Xem thử</Button></Link>} />
                </Card>
              </Space>
            </div>
          )}
        </Card>
      </Space>
    </div>
  );
}

/** Banner theo giai đoạn cảnh báo — nổi bật ở đầu màn hình. */
function AlertBanner({ s, offset, scale }: { s: OwnerStatusDto; offset: number; scale: number }) {
  const state = s.state ?? 0;
  if (s.pausedUntil && state === LifecycleState.Active) {
    return <Alert type="info" showIcon title={`Đang tạm dừng đến ${formatDateTime(s.pausedUntil)}${s.pauseReason ? ` — ${s.pauseReason}` : ''}`} />;
  }
  if (state === LifecycleState.Missed) {
    const notify = businessRemaining(s.trusteesNotifiedAt, offset, scale);
    return (
      <Alert type="warning" showIcon
        title="Bạn đã bỏ lỡ lần xác nhận gần đây."
        description={notify ? `Nếu bạn không phản hồi, người nhắc nhở của bạn sẽ được báo sau khoảng ${notify.text}. Chỉ cần bấm "Tôi vẫn ổn" bên dưới là xong.` : undefined} />
    );
  }
  if (state === LifecycleState.Grace) {
    const end = businessRemaining(s.graceEndsAt, offset, scale);
    return (
      <Alert type="error" showIcon
        title="Chúng tôi đã báo người nhắc nhở của bạn."
        description={end && !end.overdue
          ? `Còn khoảng ${end.text} trước khi thông tin tự động được gửi cho người nhận. Nếu bạn vẫn ổn, hãy bấm nút đỏ bên dưới ngay.`
          : 'Nếu bạn vẫn ổn, hãy bấm nút đỏ bên dưới ngay — nếu không, thông tin sẽ tự động được gửi cho người nhận.'} />
    );
  }
  if (state === LifecycleState.Released) {
    return <Alert type="info" showIcon title={`Hết thời gian chờ, thông tin đã được tự động gửi cho người nhận lúc ${formatDateTime(s.stateChangedAt)}.`} />;
  }
  void parseUtc;
  return null;
}
