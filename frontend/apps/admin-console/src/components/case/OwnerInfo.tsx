/**
 * Thông tin owner — CHỈ METADATA tài khoản (liên hệ, trạng thái vòng đời, nhịp check-in, số hạng mục, dung lượng).
 * Không có và không thể có nội dung két: server chỉ giữ ciphertext, khoá nằm ở phía owner/trustee.
 */
import { Descriptions, Tag, Typography } from 'antd';
import type { LifecycleState } from '@deathnote/api';
import { formatBytes, formatDate, formatDateTime, formatRelative, lifecycleStateColor, lifecycleStateLabel } from '@deathnote/ui';
import type { CaseOwnerDto } from '../../lib/types';

export function OwnerInfo({ owner }: { owner?: CaseOwnerDto }) {
  if (!owner) return null;
  const state = (owner.state ?? 0) as LifecycleState;
  return (
    <>
      <Descriptions size="small" column={{ xs: 1, md: 2 }} bordered
        items={[
          { key: 'name', label: 'Họ tên', children: owner.displayName || '—' },
          { key: 'state', label: 'Trạng thái', children: <Tag color={lifecycleStateColor[state]}>{lifecycleStateLabel[state]}</Tag> },
          { key: 'email', label: 'Email', children: owner.email || '—' },
          { key: 'phone', label: 'Số điện thoại', children: owner.phoneNumber || '—' },
          {
            key: 'lastCheckIn', label: 'Check-in cuối',
            children: owner.lastCheckInAt ? <span>{formatDateTime(owner.lastCheckInAt)} <Typography.Text type="secondary">({formatRelative(owner.lastCheckInAt)})</Typography.Text></span> : 'Chưa từng',
          },
          { key: 'interval', label: 'Nhịp check-in', children: `${owner.checkInIntervalDays ?? 0} ngày` },
          { key: 'grace', label: 'Ân hạn', children: `${owner.graceDays ?? 0} ngày${owner.graceStartedAt ? ` (bắt đầu ${formatDateTime(owner.graceStartedAt)})` : ''}` },
          { key: 'created', label: 'Tạo tài khoản', children: formatDate(owner.accountCreatedAt) },
          { key: 'vault', label: 'Két dữ liệu', span: 2, children: `${owner.vaultItemCount ?? 0} hạng mục · ${formatBytes(owner.vaultSizeBytes)} (đã mã hoá)` },
        ]} />
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: '8px 0 0' }}>
        Chỉ metadata tài khoản — console không hiển thị tên, loại hay nội dung của các hạng mục trong két.
      </Typography.Paragraph>
    </>
  );
}
