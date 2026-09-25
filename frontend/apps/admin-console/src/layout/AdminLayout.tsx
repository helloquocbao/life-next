/**
 * Khung chính của Admin Console theo tài liệu thiết kế: SIDEBAR TRÁI (menu theo quyền),
 * HEADER (tên + vai trò + đăng xuất), CONTENT ở giữa (bảng). Drawer chi tiết mở từ bên phải trong từng trang.
 *
 * Menu được dựng từ `grantedPermissions` của `/admin-dashboard/profile`:
 * không có quyền nào → màn hình NoAccess (không render layout, không gọi API nghiệp vụ nào).
 */
import { useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Badge, Button, Layout, Menu, Result, Space, Tag, Tooltip, Typography, type MenuProps } from 'antd';
import { AuditOutlined, DashboardOutlined, InboxOutlined, LogoutOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons';
import { Brand, DemoBanner, FullPageSpin, errorMessage } from '@deathnote/ui';
import { auth } from '../config';
import { useProfile, useReleaseQueue } from '../lib/api-hooks';
import { adminRoleColor, adminRoleLabel, hasPerm, Perm } from '../lib/permissions';
import { NoAccess } from './NoAccess';

const { Sider, Header, Content } = Layout;

export function AdminLayout() {
  const { data: profile, isLoading, error, refetch } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const canQueue = hasPerm(profile, Perm.Releases);
  // Badge "số hồ sơ chờ": chỉ cần totalCount của tab pending → xin 1 bản ghi cho nhẹ.
  // Dùng chung chu kỳ làm mới 15s với hàng chờ.
  const pendingQuery = useReleaseQueue('pending', 0, 1, canQueue);
  const pendingCount = pendingQuery.data?.totalCount ?? 0;

  const items = useMemo<MenuProps['items']>(() => {
    if (!profile) return [];
    const list: NonNullable<MenuProps['items']> = [];
    if (hasPerm(profile, Perm.Dashboard)) list.push({ key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' });
    if (hasPerm(profile, Perm.Releases))
      list.push({
        key: '/queue',
        icon: <InboxOutlined />,
        label: (
          <Space size={8}>
            <span>Hàng chờ mở vault</span>
            <Badge count={pendingCount} size="small" overflowCount={99} />
          </Space>
        ),
      });
    if (hasPerm(profile, Perm.AuditLog)) list.push({ key: '/audit', icon: <AuditOutlined />, label: 'Audit log' });
    if (hasPerm(profile, Perm.Policy)) list.push({ key: '/policy', icon: <SafetyCertificateOutlined />, label: 'Chính sách' });
    return list;
  }, [profile, pendingCount]);

  if (isLoading) return <FullPageSpin tip="Đang tải quyền truy cập…" />;
  if (error || !profile)
    return (
      <Result status="error" title="Không tải được thông tin tài khoản" subTitle={errorMessage(error)}
        extra={<Space><Button onClick={() => void refetch()}>Thử lại</Button><Button onClick={() => void auth.logout()}>Đăng xuất</Button></Space>} />
    );
  if (!profile.grantedPermissions?.length) return <NoAccess userName={profile.userName} />;

  const selected = '/' + (location.pathname.split('/')[1] ?? '');

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={236} theme="light" collapsible collapsed={collapsed} onCollapse={setCollapsed}
        style={{ borderRight: '1px solid #e3e8e6', position: 'sticky', top: 0, height: '100vh', overflow: 'auto' }}>
        <div style={{ padding: collapsed ? '16px 12px' : '16px 18px', borderBottom: '1px solid #e3e8e6' }}>
          {collapsed ? <Brand size={14} /> : <Brand subtitle="Console vận hành" size={17} />}
        </div>
        <Menu mode="inline" selectedKeys={[selected]} items={items} onClick={(e) => navigate(e.key)} style={{ borderInlineEnd: 0, marginTop: 8 }} />
      </Sider>
      <Layout>
        <DemoBanner timeScale={profile.timeScale} />
        <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '0 24px', borderBottom: '1px solid #e3e8e6', height: 52, lineHeight: '52px' }}>
          <Space size={6} wrap>
            {profile.roles?.map((r) => <Tag key={r} color={adminRoleColor[r] ?? 'default'}>{adminRoleLabel[r] ?? r}</Tag>)}
          </Space>
          <Tooltip title={profile.userName}>
            <Typography.Text strong><UserOutlined /> {profile.name || profile.userName}</Typography.Text>
          </Tooltip>
          <Button size="small" icon={<LogoutOutlined />} onClick={() => void auth.logout()}>Đăng xuất</Button>
        </Header>
        <Content className="admin-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
