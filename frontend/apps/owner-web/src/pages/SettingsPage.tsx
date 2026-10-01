/**
 * CÀI ĐẶT & AN TOÀN
 *  - Nhịp check-in, thời gian ân hạn, thông tin liên hệ.
 *  - Chế độ tạm dừng có thời hạn (du lịch / nhập viện) — tự hết hạn.
 *  - Bảo mật: xác thực hai lớp cho check-in, đổi passphrase, bộ khôi phục, khoá phiên.
 *  - Nhật ký hoạt động: owner xem được TOÀN BỘ log của chính mình (append-only, có chuỗi băm).
 *  - Gói dịch vụ.
 *
 * Mỗi tab là một component riêng trong components/settings/ — file này chỉ lắp ráp.
 */
import { useSearchParams } from 'react-router';
import { Tabs, Typography } from 'antd';
import { ActivityTab } from '../components/settings/ActivityTab';
import { PauseTab } from '../components/settings/PauseTab';
import { PlanTab } from '../components/settings/PlanTab';
import { ScheduleTab } from '../components/settings/ScheduleTab';
import { SecurityTab } from '../components/settings/SecurityTab';

export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  return (
    <div className="page">
      <Typography.Title level={2}>Cài đặt</Typography.Title>
      <Tabs activeKey={params.get('tab') ?? 'schedule'} onChange={(tab) => setParams({ tab })} items={[
        { key: 'schedule', label: 'Nhịp check-in', children: <ScheduleTab /> },
        { key: 'pause', label: 'Tạm dừng', children: <PauseTab /> },
        { key: 'security', label: 'Bảo mật', children: <SecurityTab /> },
        { key: 'activity', label: 'Nhật ký hoạt động', children: <ActivityTab /> },
        { key: 'plan', label: 'Gói dịch vụ', children: <PlanTab /> },
      ]} />
    </div>
  );
}
