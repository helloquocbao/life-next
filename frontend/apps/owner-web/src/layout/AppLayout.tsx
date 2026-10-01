/**
 * Khung ứng dụng Owner — bố cục sidebar trắng bên trái, theo đúng bản mockup UI mẫu
 * (màn "OW-W03 — Dashboard"): logo trên cùng, nav dọc có icon, khối hồ sơ + nút khoá phiên
 * dưới cùng. Thay cho menu ngang ở bản trước.
 *
 * Các mục nav mang `data-tour="..."` để hướng dẫn sử dụng (driver.js, xem lib/tour.ts) chỉ vào được.
 */
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { Drawer, Dropdown, Layout } from 'antd';
import {
  HomeOutlined, LockOutlined, MenuOutlined, QuestionCircleOutlined,
  SafetyCertificateOutlined, SettingOutlined, SolutionOutlined, TeamOutlined,
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
  // Vai trò trustee — người khác nhờ mình giữ khoá cho họ. Tách khỏi 5 mục trên (vai trò owner) bằng
  // đường kẻ (xem `nav` render bên dưới), không cần đã onboard làm owner mới thấy/dùng được mục này.
  { key: '/assignments', label: 'Hồ sơ tôi giữ giúp', icon: <SolutionOutlined />, tour: 'nav-assignments', section: true },
  { key: '/settings', label: 'Cài đặt', icon: <SettingOutlined />, tour: 'nav-settings' },
];

/** Dưới 768px: sidebar biến thành menu kéo ra (Drawer) mở bằng nút hamburger, để không chiếm mất màn hình hẹp. */
const MOBILE_BREAKPOINT = '(max-width: 768px)';

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const status = useOwnerStatus();
  const vaultKey = useVaultSession((s) => s.vaultKey);
  const lock = useVaultSession((s) => s.lock);
  const qc = useQueryClient();
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(MOBILE_BREAKPOINT).matches);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => installAutoLock(), []);
  // Khi khoá phiên: xoá luôn dữ liệu đã giải mã khỏi bộ nhớ đệm.
  useEffect(() => {
    if (!vaultKey) qc.removeQueries({ queryKey: ['decrypted-items'] });
  }, [vaultKey, qc]);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_BREAKPOINT);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  // Đổi trang thì tự đóng menu kéo ra (nếu đang mở).
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const initials = (status.data?.displayName ?? '?')
    .split(' ').filter(Boolean).slice(-2).map((w) => w[0]?.toUpperCase()).join('') || '?';

  const navContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Link to="/" style={{ display: 'block', padding: '26px 20px 18px' }}><Brand size={17} /></Link>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingRight: 14, flexGrow: 1 }}>
        {NAV.map((n) => {
          const active = n.key === '/' ? location.pathname === '/' : location.pathname.startsWith(n.key);
          return (
            <div key={n.key}>
              {n.section && <div style={{ height: 1, background: colors.line, margin: '8px 16px' }} />}
              <Link to={n.key} data-tour={n.tour}
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
            </div>
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
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <DemoBanner timeScale={status.data?.timeScale} />
      {isMobile && (
        <div className="no-print" style={{
          display: 'flex', alignItems: 'center', gap: 12, height: 56, padding: '0 16px',
          borderBottom: `1px solid ${colors.line}`, background: '#fff', position: 'sticky', top: 0, zIndex: 10,
        }}>
          <button type="button" aria-label="Mở menu" onClick={() => setMenuOpen(true)}
            style={{
              width: 40, height: 40, border: `1px solid ${colors.line}`, borderRadius: 10, background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: colors.ink, flexShrink: 0,
            }}>
            <MenuOutlined />
          </button>
          <Brand size={16} />
        </div>
      )}
      <Layout style={{ flex: 1 }}>
        {isMobile ? (
          <Drawer placement="left" open={menuOpen} onClose={() => setMenuOpen(false)} closable={false}
            styles={{ body: { padding: 0 } }} width={280}>
            {navContent}
          </Drawer>
        ) : (
          // Sider giãn theo đúng chiều cao thật của Content (mặc định align-items:stretch của flex row) —
          // KHÔNG ép cứng 100vh, vì cộng thêm DemoBanner phía trên sẽ vượt quá 1 màn hình và luôn tạo
          // thanh cuộn dù nội dung trang rất ngắn.
          <Layout.Sider width={240} theme="light" className="no-print"
            style={{ borderRight: `1px solid ${colors.line}`, position: 'sticky', top: 0, maxHeight: '100vh', overflow: 'auto' }}>
            {navContent}
          </Layout.Sider>
        )}

        <Layout.Content>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
