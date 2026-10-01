/**
 * Khung trang đơn giản (KHÔNG có sidebar): header trắng (logo + tên người dùng + Đăng xuất), dải
 * DemoBanner khi thời gian được nén, nội dung ở giữa rộng ~720px. Chỉ dùng cho trang lời mời — trang
 * này công khai (xem được trước khi đăng nhập) nên không thể nằm sau AuthGate + sidebar như các trang
 * còn lại của vai trò trustee (xem router.tsx).
 */
import type { ReactNode } from 'react';
import { Link, Outlet } from 'react-router';
import { Button, Flex, Layout, Typography } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { Brand, DemoBanner } from '@deathnote/ui';
import { auth } from '../../config';
import { displayName, useCurrentUser } from '../../auth/useCurrentUser';
import { useAssignments } from '../../lib/trusteePortalHooks';
import { useInboxSession } from '../../session/inboxSession';

export function PublicLayout({ children }: { children?: ReactNode }) {
  const user = useCurrentUser();
  // Hệ số nén thời gian lấy từ assignments (dùng chung cache với Home, không gọi thêm).
  const assignments = useAssignments(!!user);
  const timeScale = assignments.data?.[0]?.timeScale;

  const logout = () => {
    useInboxSession.getState().lock(); // xoá nội dung đã giải mã trước khi rời phiên
    void auth.logout();
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Header style={{ background: '#fff', borderBottom: '1px solid #e3e8e6', padding: '0 16px', height: 64 }}>
        <Flex align="center" justify="space-between" style={{ maxWidth: 720, margin: '0 auto', height: '100%' }}>
          <Link to="/"><Brand subtitle="Người được uỷ quyền" /></Link>
          {user && (
            <Flex align="center" gap={8} className="no-print">
              <Typography.Text type="secondary" ellipsis style={{ maxWidth: 180 }}>{displayName(user)}</Typography.Text>
              <Button type="text" icon={<LogoutOutlined />} onClick={logout}>Đăng xuất</Button>
            </Flex>
          )}
        </Flex>
      </Layout.Header>
      <DemoBanner timeScale={timeScale} />
      <Layout.Content>
        <div className="page-trustee">{children ?? <Outlet />}</div>
      </Layout.Content>
    </Layout>
  );
}
