/**
 * Bộ nhận diện — lấy theo bản mockup UI mẫu (death-note-app.html, 291 màn hình iOS/Web/Admin).
 * Tinh thần: "editorial/journal" ấm áp, đáng tin — nền giấy kem, chữ serif cho tiêu đề/số liệu,
 * xanh rêu đậm làm điểm nhấn duy nhất. KHÔNG dùng hình ảnh/màu sắc tang tóc.
 *
 *   - Nền giấy kem (paper): #F7F5F0 (Owner/Trustee) — mockup dùng chính xác giá trị này.
 *   - Xanh rêu đậm (accent): #1F5F5B — nút chính, vòng tiến độ, mục điều hướng đang chọn.
 *   - Chữ tiêu đề: font serif "Lora" — số liệu lớn và heading dùng font này, phần còn lại dùng
 *     "Be Vietnam Pro" (sans). Cả hai import qua Google Fonts trong index.html của từng app.
 *   - Admin console dùng sidebar TỐI (#14211F) theo đúng mockup Web Admin — khác Owner/Trustee.
 */
import type { ThemeConfig } from 'antd';

export const colors = {
  primary: '#1F5F5B',
  primaryDark: '#164743',
  primarySoft: '#EDF1EF',
  amber: '#8A5A00',
  amberSoft: '#FBF3E2',
  red: '#A31E15',
  redSoft: '#F9E9E6',
  success: '#25604A',
  ink: '#1C1C1A',
  muted: '#5E5B54',
  mutedSoft: '#7A776F',
  line: '#EAE5D9',
  lineSoft: '#F0ECE1',
  paper: '#F7F5F0',
  // Bảng màu riêng cho sidebar tối của Admin console (theo mockup Web Admin).
  adminSiderBg: '#14211F',
  adminSiderActiveBg: '#1E312E',
  adminSiderText: '#C3CDCA',
  adminSiderMuted: '#8FA5A0',
  adminBodyBg: '#F2F0EA',
} as const;

/** Font tiêu đề/số liệu lớn (serif, theo mockup) — dùng qua CSS class `.font-serif` hoặc thẻ h1-h5. */
export const fontSerif = `'Lora', Georgia, 'Times New Roman', serif`;
export const fontSans = `'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

/**
 * `consumer`: Owner/Trustee — nền giấy kem, sidebar trắng, chữ to, nút to (người 60 tuổi dùng được).
 * `admin`: Console vận hành — nền xám ấm, sidebar tối, mật độ thông tin cao.
 */
export function createTheme(variant: 'consumer' | 'admin'): ThemeConfig {
  const consumer = variant === 'consumer';
  return {
    token: {
      colorPrimary: colors.primary,
      colorSuccess: colors.success,
      colorWarning: colors.amber,
      colorWarningBg: colors.amberSoft,
      colorError: colors.red,
      colorErrorBg: colors.redSoft,
      colorText: colors.ink,
      colorTextSecondary: colors.muted,
      colorBorder: colors.line,
      colorBorderSecondary: consumer ? colors.line : '#E4DFD2',
      colorBgLayout: consumer ? colors.paper : colors.adminBodyBg,
      borderRadius: consumer ? 12 : 10,
      fontSize: consumer ? 16 : 14,
      controlHeight: consumer ? 44 : 34,
      fontFamily: fontSans,
    },
    components: {
      Button: { fontWeight: 600, primaryShadow: 'none' },
      Card: {
        borderRadiusLG: consumer ? 16 : 14,
        headerFontSize: consumer ? 17 : 15,
        colorBorderSecondary: consumer ? colors.line : '#E4DFD2',
      },
      Layout: consumer
        ? { headerBg: '#ffffff', siderBg: '#ffffff', bodyBg: colors.paper }
        : { headerBg: '#ffffff', siderBg: colors.adminSiderBg, bodyBg: colors.adminBodyBg, triggerBg: colors.adminSiderActiveBg },
      Menu: consumer
        ? {}
        : {
            darkItemBg: colors.adminSiderBg,
            darkItemSelectedBg: colors.adminSiderActiveBg,
            darkItemColor: colors.adminSiderText,
            darkItemHoverColor: '#ffffff',
            darkSubMenuItemBg: colors.adminSiderBg,
          },
    },
  };
}
