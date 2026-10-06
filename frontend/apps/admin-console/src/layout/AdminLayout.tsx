/**
 * Khung chính của Admin Console theo mockup Web Admin: SIDEBAR TỐI bên trái (menu nhóm theo mảng việc,
 * thẻ tài khoản ở đáy), HEADER (nút thu gọn + breadcrumb), CONTENT ở giữa.
 *
 * Menu được dựng từ `grantedPermissions` của `/admin-dashboard/profile`:
 * không có quyền nào → màn hình NoAccess (không render layout, không gọi API nghiệp vụ nào).
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Avatar, Button, Layout, Menu, Result, Space, Tag, Tooltip, Typography, type MenuProps } from 'antd';
import {
  AuditOutlined, DashboardOutlined, IdcardOutlined, LogoutOutlined, MailOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  KeyOutlined, SafetyCertificateOutlined, TeamOutlined,
} from '@ant-design/icons';
import { Brand, DemoBanner, FullPageSpin, errorMessage } from '@deathnote/ui';
import type { AdminProfileDto } from '@deathnote/api';
import { auth } from '../config';
import { useProfile } from '../lib/api-hooks';
import { hasPerm, Perm, roleColor, roleLabel, type PermissionName } from '../lib/permissions';
import { NoAccess } from './NoAccess';

const { Sider, Header, Content } = Layout;

type NavItem = { key: string; label: string; icon: ReactNode; perm: PermissionName };
type NavGroup = { label: string; items: NavItem[] };

/** Menu chia theo mảng việc để người vận hành tìm đúng chỗ: vận hành / giám sát / cấu hình. */
const NAV: NavGroup[] = [
  {
    label: 'Vận hành',
    items: [
      { key: '/dashboard', label: 'Tổng quan', icon: <DashboardOutlined />, perm: Perm.Dashboard },
      { key: '/customers', label: 'Khách hàng', icon: <TeamOutlined />, perm: Perm.Customers },
      { key: '/staff', label: 'Nhân viên', icon: <IdcardOutlined />, perm: Perm.Staff },
    ],
  },
  { label: 'Giám sát', items: [{ key: '/audit', label: 'Audit log', icon: <AuditOutlined />, perm: Perm.AuditLog }] },
  {
    label: 'Cấu hình',
    items: [
      { key: '/roles', label: 'Vai trò & quyền', icon: <KeyOutlined />, perm: Perm.Roles },
      { key: '/policy', label: 'Chính sách', icon: <SafetyCertificateOutlined />, perm: Perm.Policy },
      { key: '/email-templates', label: 'Mẫu email', icon: <MailOutlined />, perm: Perm.EmailTemplates },
    ],
  },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2)) ?? '?').toUpperCase();
}

export function AdminLayout() {
  const { data: profile, isLoading, error, refetch } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const groups = useMemo(
    () => (profile ? NAV.map((g) => ({ ...g, items: g.items.filter((i) => hasPerm(profile, i.perm)) })).filter((g) => g.items.length) : []),
    [profile],
  );

  const items = useMemo<MenuProps['items']>(
    () => groups.map((g) => ({
      type: 'group' as const,
      key: g.label,
      label: collapsed ? null : g.label,
      children: g.items.map((i) => ({ key: i.key, icon: i.icon, label: i.label })),
    })),
    [groups, collapsed],
  );

  if (isLoading) return <FullPageSpin tip="Đang tải quyền truy cập…" />;
  if (error || !profile)
    return (
      <Result status="error" title="Không tải được thông tin tài khoản" subTitle={errorMessage(error)}
        extra={<Space><Button onClick={() => void refetch()}>Thử lại</Button><Button onClick={() => void auth.logout()}>Đăng xuất</Button></Space>} />
    );
  if (!profile.grantedPermissions?.length) return <NoAccess userName={profile.userName} />;

  const selected = '/' + (location.pathname.split('/')[1] ?? '');
  const currentGroup = groups.find((g) => g.items.some((i) => i.key === selected));
  const currentItem = currentGroup?.items.find((i) => i.key === selected);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={248} collapsedWidth={72} theme="dark" trigger={null} collapsible collapsed={collapsed} className="admin-sider">
        <div className="admin-sider-inner">
          <div className={'admin-sider-brand' + (collapsed ? ' collapsed' : '')}>
            {collapsed ? <Brand size={20} markOnly /> : <Brand subtitle="Console vận hành" size={17} inverted />}
          </div>
          <Menu theme="dark" mode="inline" selectedKeys={[selected]} items={items} onClick={(e) => navigate(e.key)} className="admin-menu" />
          <UserCard profile={profile} collapsed={collapsed} />
        </div>
      </Sider>
      <Layout>
        <Header className="admin-header">
          <Space size={12} align="center">
            <Button type="text" aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(!collapsed)} />
            <div className="admin-breadcrumb">
              {currentGroup && <span className="muted">{currentGroup.label}</span>}
              {currentGroup && <span className="admin-breadcrumb-sep">/</span>}
              <span>{currentItem?.label ?? 'Không tìm thấy trang'}</span>
            </div>
          </Space>
        </Header>
        <DemoBanner timeScale={profile.timeScale} />
        <Content className="admin-content">
          <div className="admin-container">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

/** Thẻ tài khoản ở đáy sidebar: ai đang đăng nhập, vai trò gì, nút đăng xuất. */
function UserCard({ profile, collapsed }: { profile: AdminProfileDto; collapsed: boolean }) {
  const name = profile.name || profile.userName || '';
  const logout = (
    <Tooltip title="Đăng xuất" placement="right">
      <Button type="text" className="admin-user-logout" aria-label="Đăng xuất" icon={<LogoutOutlined />} onClick={() => void auth.logout()} />
    </Tooltip>
  );
  if (collapsed)
    return (
      <div className="admin-user collapsed">
        <Tooltip title={name} placement="right"><Avatar size={32} className="admin-user-avatar">{initials(name)}</Avatar></Tooltip>
        {logout}
      </div>
    );
  return (
    <div className="admin-user">
      <Avatar size={36} className="admin-user-avatar">{initials(name)}</Avatar>
      <div className="admin-user-info">
        <Typography.Text className="admin-user-name" ellipsis={{ tooltip: profile.userName }}>{name}</Typography.Text>
        <div className="admin-user-roles">
          {profile.roles?.map((r) => <Tag key={r} color={roleColor(r)} variant="filled">{roleLabel(r)}</Tag>)}
        </div>
      </div>
      {logout}
    </div>
  );
}
