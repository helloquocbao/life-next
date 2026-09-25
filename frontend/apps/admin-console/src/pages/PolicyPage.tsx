/**
 * CHÍNH SÁCH VÒNG ĐỜI (read-only) — các tham số quyết định khi nào hồ sơ chuyển trạng thái.
 *
 * Mỗi tham số kèm giải thích nghiệp vụ để đội vận hành / nhà đầu tư hiểu vì sao hệ thống an toàn:
 * nhiều lớp thời gian (nhắc → ân hạn → thẩm định → chờ cuối) trước khi bất kỳ dữ liệu nào được bàn giao.
 * Thay đổi chính sách cần 2 người duyệt — chưa có trong MVP (Phase 2).
 */
import { Alert, Card, Descriptions, Skeleton, Space, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import { ErrorAlert, humanizeBusiness } from '@deathnote/ui';
import { usePolicy } from '../lib/api-hooks';
import { PageTitle } from '../components/PageTitle';

function Item({ value, hint }: { value: ReactNode; hint: string }) {
  return (
    <div>
      <Typography.Text strong>{value}</Typography.Text>
      <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{hint}</Typography.Text></div>
    </div>
  );
}

export function PolicyPage() {
  const { data: p, isLoading, error } = usePolicy(true);

  return (
    <>
      <PageTitle title="Chính sách vòng đời" subtitle="Tham số đang áp dụng cho toàn hệ thống (chỉ xem)." />
      <Alert type="info" showIcon style={{ marginBottom: 12 }}
        title="Mọi thay đổi chính sách cần 2 người duyệt — sẽ có ở Phase 2." />
      <ErrorAlert error={error} style={{ marginBottom: 12 }} />
      {isLoading ? <Skeleton active /> : p && (
        <Card size="small">
          <Descriptions size="small" bordered column={1} styles={{ label: { width: 260 } }}
            items={[
              {
                key: 'intervals', label: 'Nhịp check-in cho phép',
                children: <Item value={<Space size={4} wrap>{(p.allowedCheckInIntervals ?? []).map((d) => <Tag key={d}>{d} ngày</Tag>)}</Space>}
                  hint="Owner chọn một trong các nhịp này; quá nhịp mà không check-in thì chuyển sang 'Quá hạn check-in'." />,
              },
              {
                key: 'missed', label: 'Giai đoạn quá hạn (Missed)',
                children: <Item value={`${p.missedPhaseDays ?? 0} ngày`} hint="Thời gian hệ thống liên tục nhắc owner trước khi báo cho người thân (Grace)." />,
              },
              {
                key: 'channels', label: 'Kênh nhắc nhở',
                children: <Item value={<Space size={4} wrap>{(p.reminderChannels ?? []).map((c) => <Tag key={c}>{c}</Tag>)}</Space>}
                  hint="Các kênh dùng để nhắc owner check-in ở giai đoạn Missed." />,
              },
              {
                key: 'grace', label: 'Thời gian ân hạn (Grace)',
                children: <Item value={`Mặc định ${p.defaultGraceDays ?? 0} ngày (owner chọn ${p.minGraceDays ?? 0}–${p.maxGraceDays ?? 0} ngày)`}
                  hint="Người thân được báo và có thể phản hồi còn liên lạc được; chưa ai được khởi tạo yêu cầu mở." />,
              },
              {
                key: 'sla', label: 'SLA thẩm định',
                children: <Item value={`${p.reviewSlaDays ?? 0} ngày`} hint="Thời hạn đội PICO phải hoàn tất 2 phiếu kể từ khi hồ sơ đủ điều kiện thẩm định; quá hạn hiển thị đỏ trong hàng chờ." />,
              },
              {
                key: 'final', label: 'Thời gian chờ cuối (FinalWait)',
                children: <Item value={`${p.finalWaitHours ?? 0} giờ`} hint="Sau phiếu phê duyệt, owner vẫn có thể huỷ bằng một lần check-in; hết thời gian này mảnh khoá mới được chuyển." />,
              },
              {
                key: 'pause', label: 'Tạm dừng tối đa',
                children: <Item value={`${p.maxPauseDays ?? 0} ngày`} hint="Owner có thể tạm dừng đếm giờ (đi xa, nằm viện có kế hoạch) tối đa chừng này ngày." />,
              },
              {
                key: 'newTrustee', label: 'Ngưỡng "trustee mới"',
                children: <Item value={`${p.newTrusteeRiskDays ?? 0} ngày`} hint="Trustee được thêm trong khoảng này trước yêu cầu mở sẽ bị gắn cờ rủi ro." />,
              },
              {
                key: 'retention', label: 'Lưu giữ bằng chứng',
                children: <Item value={`${p.evidenceRetentionDays ?? 0} ngày`} hint="Tệp bằng chứng (CCCD, giấy chứng tử…) tự xoá sau thời hạn này, chỉ giữ lại metadata." />,
              },
              {
                key: 'distinctIp', label: 'Đồng thuận phải khác IP',
                children: <Item value={p.enforceDistinctConsentIp ? <Tag color="green">Bật</Tag> : <Tag>Tắt</Tag>}
                  hint="Khi bật, các đồng thuận đến từ cùng một địa chỉ IP chỉ được tính là một (chống một người giả nhiều trustee)." />,
              },
              {
                key: 'timeScale', label: 'Hệ số nén thời gian',
                children: <Item value={(p.timeScale ?? 1) > 1 ? `×${p.timeScale} (1 giờ thật ≈ ${humanizeBusiness(3600_000 * (p.timeScale ?? 1))})` : 'Không nén (thời gian thực)'}
                  hint="Chỉ dùng cho môi trường trình diễn; môi trường thật luôn là ×1." />,
              },
            ]} />
        </Card>
      )}
    </>
  );
}
