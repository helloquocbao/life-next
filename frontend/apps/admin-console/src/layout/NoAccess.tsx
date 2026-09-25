/**
 * Màn hình cho tài khoản đăng nhập thành công nhưng không có quyền vận hành nào
 * (vd. một owner/trustee lỡ mở console). Không lộ bất kỳ dữ liệu nào, chỉ cho đăng xuất.
 */
import { Button, Result } from 'antd';
import { Brand } from '@deathnote/ui';
import { auth } from '../config';

export function NoAccess({ userName }: { userName?: string | null }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
      <Brand subtitle="Console vận hành" />
      <Result
        status="403"
        title="Tài khoản của bạn không có quyền truy cập console vận hành"
        subTitle={userName ? `Đang đăng nhập: ${userName}. Liên hệ quản trị hệ thống nếu bạn cần được cấp vai trò.` : undefined}
        extra={<Button type="primary" onClick={() => void auth.logout()}>Đăng xuất</Button>}
      />
    </div>
  );
}
