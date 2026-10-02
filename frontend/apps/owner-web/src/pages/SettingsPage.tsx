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
import { Button, Flex, Grid, Tabs, Typography } from 'antd';
import { ActivityTab } from '../components/settings/ActivityTab';
import { PauseTab } from '../components/settings/PauseTab';
import { PlanTab } from '../components/settings/PlanTab';
import { ScheduleTab } from '../components/settings/ScheduleTab';
import { SecurityTab } from '../components/settings/SecurityTab';

const TABS = [
  { key: 'schedule', label: 'Nhịp check-in', children: <ScheduleTab /> },
  { key: 'pause', label: 'Tạm dừng', children: <PauseTab /> },
  { key: 'security', label: 'Bảo mật', children: <SecurityTab /> },
  { key: 'activity', label: 'Nhật ký hoạt động', children: <ActivityTab /> },
  { key: 'plan', label: 'Gói dịch vụ', children: <PlanTab /> },
];

export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  // useBreakpoint trả {} ở lần render đầu — đọc thẳng media query để khỏi nháy sai bố cục.
  const wide = Grid.useBreakpoint().md ?? window.matchMedia('(min-width: 768px)').matches;
  const active = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab')! : 'schedule';
  return (
    <div className="page">
      <Typography.Title level={2}>Cài đặt</Typography.Title>
      {wide ? (
        <Tabs activeKey={active} onChange={(tab) => setParams({ tab })} items={TABS} />
      ) : (
        // Điện thoại: 5 tab không vừa một hàng — hiện dạng nút tự xuống dòng để thấy đủ mọi mục, khỏi phải vuốt ngang.
        <>
          <Flex wrap gap={8} style={{ marginBottom: 16 }}>
            {TABS.map((t) => (
              <Button key={t.key} type={t.key === active ? 'primary' : 'default'} onClick={() => setParams({ tab: t.key })}>
                {t.label}
              </Button>
            ))}
          </Flex>
          {TABS.find((t) => t.key === active)!.children}
        </>
      )}
    </div>
  );
}
