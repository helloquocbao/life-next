/**
 * Thư mở đầu — toàn màn hình, chữ lớn, nền giấy dịu. Đây là điều đầu tiên người thân đọc được:
 * lời của chính owner, trước mọi danh sách tài sản hay việc cần làm.
 */
import { Button, Typography } from 'antd';

export function LetterScreen({ ownerName, letter, onContinue }: { ownerName: string; letter: string; onContinue: () => void }) {
  return (
    <div className="letter-screen" role="dialog" aria-label="Thư mở đầu">
      <div className="letter-inner">
        <Typography.Text type="secondary" style={{ fontSize: 16 }}>Lời nhắn từ {ownerName}</Typography.Text>
        <div className="letter-body" style={{ marginTop: 24 }}>{letter}</div>
        <Button type="primary" size="large" style={{ marginTop: 48, height: 56, minWidth: 200, fontSize: 18 }} onClick={onContinue}>
          Tiếp tục
        </Button>
      </div>
    </div>
  );
}
