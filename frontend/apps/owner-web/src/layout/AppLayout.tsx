/**
 * Khung ứng dụng Owner — bố cục sidebar trắng bên trái, theo đúng bản mockup UI mẫu
 * (màn "OW-W03 — Dashboard"): logo trên cùng, nav dọc có icon, khối hồ sơ + nút khoá phiên
 * dưới cùng. Thay cho menu ngang ở bản trước.
 *
 * Các mục nav mang `data-tour="..."` để hướng dẫn sử dụng (driver.js, xem lib/tour.ts) chỉ vào được.
 */
import { useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { Dropdown, Layout } from 'antd';
import {
  HomeOutlined, LockOutlined, QuestionCircleOutlined,
  SafetyCertificateOutlined, SettingOutlined, TeamOutlined,
} from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { Brand, DemoBanner, colors } from '@deathnote/ui';
import { auth } from '../config';
import { useOwnerStatus } from '../lib/api-hooks';
import { installAutoLock, useVaultSession } from '../session/vaultSession';

const NAV = [
  { key: '/', label: 'Trang chủ', icon: <HomeOutlined /> },
  { key: '/vault', label: 'Két thông tin', icon: <LockOutlined />, tour: 'nav-vault' },
  { key: '/assets', label: 'Tài sản & quyền lợi', icon: <SafetyCertificateOutlined />, tour: 'nav-assets' },
  { key: '/recipients', label: 'Người nhận', icon: <TeamOutlined />, tour: 'nav-recipients' },
  { key: '/settings', label: 'Cài đặt', icon: <SettingOutlined />, tour: 'nav-settings' },
];

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const status = useOwnerStatus();
  const vaultKey = useVaultSession((s) => s.vaultKey);
  const lock = useVaultSession((s) => s.lock);
  const qc = useQueryClient();

  useEffect(() => installAutoLock(), []);
  // Khi khoá phiên: xoá luôn dữ liệu đã giải mã khỏi bộ nhớ đệm.
  useEffect(() => {
    if (!vaultKey) qc.removeQueries({ queryKey: ['decrypted-items'] });
  }, [vaultKey, qc]);

  const initials = (status.data?.displayName ?? '?')
    .split(' ').filter(Boolean).slice(-2).map((w) => w[0]?.toUpperCase()).join('') || '?';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <DemoBanner timeScale={status.data?.timeScale} />
      <Layout style={{ flex: 1 }}>
        {/* Sider giãn theo đúng chiều cao thật của Content (mặc định align-items:stretch của flex row) —
            KHÔNG ép cứng 100vh, vì cộng thêm DemoBanner phía trên sẽ vượt quá 1 màn hình và luôn tạo
            thanh cuộn dù nội dung trang rất ngắn. */}
        <Layout.Sider width={240} theme="light" className="no-print"
          style={{ borderRight: `1px solid ${colors.line}`, position: 'sticky', top: 0, maxHeight: '100vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Link to="/" style={{ display: 'block', padding: '26px 20px 18px' }}><Brand size={17} /></Link>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingRight: 14, flexGrow: 1 }}>
            {NAV.map((n) => {
              const active = n.key === '/' ? location.pathname === '/' : location.pathname.startsWith(n.key);
              return (
                <Link key={n.key} to={n.key} data-tour={n.tour}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, height: 44,
                    padding: active ? '0 14px 0 13px' : '0 14px 0 16px',
                    borderLeft: active ? `3px solid ${colors.primary}` : '3px solid transparent',
                    borderRadius: '0 11px 11px 0',
                    background: active ? colors.primarySoft : 'transparent',
                    color: active ? colors.primaryDark : colors.muted,
                    fontSize: 14.5, fontWeight: active ? 600 : 400, textDecoration: 'none',
                  }}>
                  {n.icon}<span>{n.label}</span>
                </Link>
              );
            })}
          </nav>

          <div style={{ borderTop: `1px solid ${colors.line}`, padding: '14px 16px 18px' }}>
            <Dropdown trigger={['click']} menu={{
              items: [
                { key: 'tour', icon: <QuestionCircleOutlined />, label: 'Hướng dẫn sử dụng', onClick: () => navigate('/?tour=1') },
                { key: 'dry', label: <Link to="/dry-run">Diễn tập quy trình</Link> },
                { key: 'logout', label: 'Đăng xuất', onClick: () => { lock(); void auth.logout(); } },
              ],
            }}>
              <div data-tour="user-menu" style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer' }}>
                <span style={{
                  width: 36, height: 36, borderRadius: 18, background: colors.primary, color: '#fff',
                  fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>{initials}</span>
                <span style={{ flexGrow: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: colors.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {status.data?.displayName ?? ''}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: colors.mutedSoft, marginTop: 1 }}>Chủ tài khoản</span>
                </span>
              </div>
            </Dropdown>
            <button type="button" data-tour="lock-toggle" onClick={lock} disabled={!vaultKey}
              style={{
                marginTop: 12, width: '100%', height: 38, border: `1px solid ${colors.line}`, borderRadius: 11,
                background: '#fff', color: colors.muted, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 500,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                cursor: vaultKey ? 'pointer' : 'default', opacity: vaultKey ? 1 : 0.5,
              }}>
              <LockOutlined /><span>Khoá phiên</span>
            </button>
          </div>
        </div>
        </Layout.Sider>

        <Layout.Content>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
