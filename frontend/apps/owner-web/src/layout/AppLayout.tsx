/**
 * Khung ứng dụng Owner/Trustee — một app, hai vai trò trên cùng tài khoản.
 *
 *  - Màn rộng: sidebar trắng bên trái, nav chia NHÓM theo vai trò (xem NAV_GROUPS) để người dùng luôn
 *    biết mình đang ở "hồ sơ của mình" hay "hồ sơ giữ giúp người khác".
 *  - Màn hẹp (app điện thoại): thanh tab dưới đáy (ngón cái với tới) cho 4 mục chính + "Thêm"; phần còn
 *    lại (giữ giúp, cài đặt, khoá phiên, đăng xuất) nằm trong ngăn kéo "Thêm". Không còn hamburger.
 *  - Nhóm "Tôi giữ giúp người khác" chỉ hiện khi tài khoản thực sự là trustee của ai đó — owner thường
 *    không phải nhìn một mục họ không dùng.
 *
 * Các mục nav mang `data-tour="..."` để hướng dẫn sử dụng (driver.js, xem lib/tour.ts) chỉ vào được.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { Badge, Drawer, Dropdown, Layout } from 'antd';
import {
  EllipsisOutlined, ExperimentOutlined, HomeOutlined, LockOutlined, LogoutOutlined, QuestionCircleOutlined,
  SafetyCertificateOutlined, SettingOutlined, SolutionOutlined, TeamOutlined,
} from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { Brand, DemoBanner, colors } from '@deathnote/ui';
import { auth } from '../config';
import { useOwnerStatus } from '../lib/api-hooks';
import { useAssignments } from '../lib/trusteePortalHooks';
import { installAutoLock, useVaultSession } from '../session/vaultSession';

type NavItem = { key: string; label: string; short?: string; icon: ReactNode; tour?: string; badge?: number };
type NavGroup = { label?: string; items: NavItem[] };

/** Dưới 768px: nav chuyển xuống thanh tab đáy màn hình. */
const MOBILE_BREAKPOINT = '(max-width: 768px)';

const OWNER_ITEMS: NavItem[] = [
  { key: '/', label: 'Trang chủ', icon: <HomeOutlined /> },
  { key: '/vault', label: 'Két thông tin', short: 'Két', icon: <LockOutlined />, tour: 'nav-vault' },
  { key: '/assets', label: 'Tài sản & quyền lợi', short: 'Tài sản', icon: <SafetyCertificateOutlined />, tour: 'nav-assets' },
  { key: '/recipients', label: 'Người nhận', icon: <TeamOutlined />, tour: 'nav-recipients' },
];

const isActive = (pathname: string, key: string) => (key === '/' ? pathname === '/' : pathname.startsWith(key));

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const status = useOwnerStatus();
  const assignments = useAssignments();
  const vaultKey = useVaultSession((s) => s.vaultKey);
  const lock = useVaultSession((s) => s.lock);
  const qc = useQueryClient();
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(MOBILE_BREAKPOINT).matches);
  const [moreOpen, setMoreOpen] = useState(false);

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
  // Đổi trang thì tự đóng ngăn "Thêm" (nếu đang mở).
  useEffect(() => setMoreOpen(false), [location.pathname]);

  const initials = (status.data?.displayName ?? '?')
    .split(' ').filter(Boolean).slice(-2).map((w) => w[0]?.toUpperCase()).join('') || '?';

  const heldCount = assignments.data?.length ?? 0;
  const heldItem: NavItem = {
    key: '/assignments', label: 'Hồ sơ tôi giữ giúp', icon: <SolutionOutlined />, tour: 'nav-assignments', badge: heldCount,
  };
  const settingsItem: NavItem = { key: '/settings', label: 'Cài đặt', icon: <SettingOutlined />, tour: 'nav-settings' };

  const groups = useMemo<NavGroup[]>(() => {
    const list: NavGroup[] = [{ label: heldCount > 0 ? 'Hồ sơ của tôi' : undefined, items: OWNER_ITEMS }];
    if (heldCount > 0) list.push({ label: 'Tôi giữ giúp người khác', items: [heldItem] });
    list.push({ items: [settingsItem] });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heldCount]);

  const logout = () => { lock(); void auth.logout(); };

  const userBlock = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <span style={{
        width: 36, height: 36, borderRadius: 18, background: colors.primary, color: '#fff',
        fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{initials}</span>
      <span style={{ flexGrow: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: colors.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {status.data?.displayName ?? ''}
        </span>
        <span style={{ display: 'block', fontSize: 12, color: colors.mutedSoft, marginTop: 1 }}>
          {status.data?.email ?? 'Chủ tài khoản'}
        </span>
      </span>
    </div>
  );

  const lockButton = (
    <button type="button" data-tour="lock-toggle" onClick={lock} disabled={!vaultKey} className="app-lock-btn">
      <LockOutlined /><span>{vaultKey ? 'Khoá phiên ngay' : 'Phiên đang khoá'}</span>
    </button>
  );

  /* ───────── Sidebar (màn rộng) ───────── */
  const sidebar = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Link to="/" style={{ display: 'block', padding: '26px 20px 18px' }}><Brand size={17} /></Link>

      <nav style={{ display: 'flex', flexDirection: 'column', paddingRight: 14, flexGrow: 1 }}>
        {groups.map((g, gi) => (
          <div key={gi} className="app-nav-group">
            {g.label ? <div className="app-nav-label">{g.label}</div> : gi > 0 && <div className="app-nav-divider" />}
            {g.items.map((n) => (
              <Link key={n.key} to={n.key} data-tour={n.tour} className={'app-nav-item' + (isActive(location.pathname, n.key) ? ' active' : '')}>
                {n.icon}<span style={{ flexGrow: 1 }}>{n.label}</span>
                {!!n.badge && <Badge count={n.badge} color={colors.primary} size="small" />}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div style={{ borderTop: `1px solid ${colors.line}`, padding: '14px 16px 18px' }}>
        <Dropdown trigger={['click']} menu={{
          items: [
            { key: 'tour', icon: <QuestionCircleOutlined />, label: 'Hướng dẫn sử dụng', onClick: () => navigate('/?tour=1') },
            { key: 'dry', icon: <ExperimentOutlined />, label: 'Diễn tập quy trình', onClick: () => navigate('/dry-run') },
            { type: 'divider' },
            { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', onClick: logout },
          ],
        }}>
          <div data-tour="user-menu" style={{ cursor: 'pointer' }}>{userBlock}</div>
        </Dropdown>
        {lockButton}
      </div>
    </div>
  );

  /* ───────── Thanh tab đáy + ngăn "Thêm" (màn hẹp) ───────── */
  const moreActive = !OWNER_ITEMS.some((n) => isActive(location.pathname, n.key));
  const tabbar = (
    <nav className="app-tabbar no-print" aria-label="Điều hướng chính">
      {OWNER_ITEMS.map((n) => (
        <Link key={n.key} to={n.key} data-tour={n.tour} className={'app-tab' + (isActive(location.pathname, n.key) ? ' active' : '')}>
          {n.icon}<span>{n.short ?? n.label}</span>
        </Link>
      ))}
      <button type="button" className={'app-tab' + (moreActive ? ' active' : '')} onClick={() => setMoreOpen(true)} aria-label="Mở thêm">
        <Badge dot={heldCount > 0} color={colors.primary} offset={[-2, 2]}><EllipsisOutlined /></Badge>
        <span>Thêm</span>
      </button>
    </nav>
  );

  const moreItems: NavItem[] = [...(heldCount > 0 ? [heldItem] : []), settingsItem];
  const moreDrawer = (
    <Drawer placement="bottom" open={moreOpen} onClose={() => setMoreOpen(false)} closable={false} height="auto"
      styles={{ body: { padding: '8px 0 12px' }, wrapper: { borderRadius: '18px 18px 0 0' } }}>
      <div style={{ padding: '10px 20px 14px', borderBottom: `1px solid ${colors.line}` }}>{userBlock}</div>
      <div className="app-more-list">
        {moreItems.map((n) => (
          <Link key={n.key} to={n.key} data-tour={n.tour} className="app-more-item">
            {n.icon}<span style={{ flexGrow: 1 }}>{n.label}</span>
            {!!n.badge && <Badge count={n.badge} color={colors.primary} size="small" />}
          </Link>
        ))}
        <Link to="/dry-run" className="app-more-item"><ExperimentOutlined /><span>Diễn tập quy trình</span></Link>
        <Link to="/?tour=1" className="app-more-item"><QuestionCircleOutlined /><span>Hướng dẫn sử dụng</span></Link>
        <button type="button" className="app-more-item danger" onClick={logout}><LogoutOutlined /><span>Đăng xuất</span></button>
      </div>
    </Drawer>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <DemoBanner timeScale={status.data?.timeScale} />
      {isMobile && (
        <div className="no-print app-topbar">
          <Link to="/"><Brand size={16} /></Link>
          <button type="button" data-tour="lock-toggle" aria-label="Khoá phiên" onClick={lock} disabled={!vaultKey} className="app-topbar-lock">
            <LockOutlined />
          </button>
        </div>
      )}
      <Layout style={{ flex: 1 }}>
        {!isMobile && (
          // Sider giãn theo đúng chiều cao thật của Content (mặc định align-items:stretch của flex row) —
          // KHÔNG ép cứng 100vh, vì cộng thêm DemoBanner phía trên sẽ vượt quá 1 màn hình và luôn tạo
          // thanh cuộn dù nội dung trang rất ngắn.
          <Layout.Sider width={248} theme="light" className="no-print"
            style={{ borderRight: `1px solid ${colors.line}`, position: 'sticky', top: 0, maxHeight: '100vh', overflow: 'auto' }}>
            {sidebar}
          </Layout.Sider>
        )}
        <Layout.Content className={isMobile ? 'app-content-mobile' : undefined}>
          <Outlet />
        </Layout.Content>
      </Layout>
      {isMobile && tabbar}
      {isMobile && moreDrawer}
    </Layout>
  );
}
