import { Typography } from 'antd';

/** Tuyên bố pháp lý bắt buộc xuất hiện ở onboarding, điều khoản và màn hình trustee. */
export function LegalNotice({ style }: { style?: React.CSSProperties }) {
  return (
    <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: 0, ...style }}>
      Death Note bàn giao thông tin, không xác nhận tình trạng tử vong, không thay thế di chúc hợp pháp và
      không chuyển giao quyền sở hữu tài sản.
    </Typography.Paragraph>
  );
}
