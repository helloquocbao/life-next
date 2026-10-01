/**
 * Hộp nhận — nơi người thân nhận phần owner để lại. Thứ tự hiển thị có chủ đích:
 *   0) Nhập passphrase → ghép khoá Shamir & giải mã NGAY TRÊN TRÌNH DUYỆT (xem lib/inbox.ts).
 *   a) Thư mở đầu — toàn màn hình, trước mọi thứ khác.
 *   b) Bản đồ tài sản (số lượng theo loại) → c) Checklist việc cần làm → d) Chi tiết hạng mục → e) Xuất PDF.
 *
 * Nội dung đã giải mã chỉ ở trong bộ nhớ (zustand), không ghi xuống storage.
 */
import { useParams, useNavigate } from 'react-router';
import { Button, Card, Flex, Typography } from 'antd';
import { ArrowLeftOutlined, LockOutlined, PrinterOutlined } from '@ant-design/icons';
import { ErrorAlert, FullPageSpin, LegalNotice, formatDateTime } from '@deathnote/ui';
import { PassphraseForm } from '../components/PassphraseForm';
import { useKeyring } from '../lib/api-hooks';
import { openInboxWithPassphrase } from '../lib/inbox';
import { useInboxSession } from '../session/inboxSession';
import { LetterScreen } from './inbox/LetterScreen';
import { AssetMap } from './inbox/AssetMap';
import { Checklist } from './inbox/Checklist';
import { ItemDetails } from './inbox/ItemDetails';

export function InboxPage() {
  const { trusteeId = '' } = useParams();
  const navigate = useNavigate();
  const keyring = useKeyring();
  const inbox = useInboxSession((s) => s.inboxes[trusteeId]);
  const setInbox = useInboxSession((s) => s.setInbox);
  const markLetterSeen = useInboxSession((s) => s.markLetterSeen);
  const lock = useInboxSession((s) => s.lock);

  if (keyring.isLoading) return <FullPageSpin />;
  if (keyring.error) return <ErrorAlert error={keyring.error} />;

  // Bước 0: chưa mở → nhập passphrase.
  if (!inbox)
    return (
      <Card>
        <Typography.Title level={3} style={{ marginTop: 0 }}>Mở hộp nhận</Typography.Title>
        <Typography.Paragraph>
          Nhập passphrase khoá cá nhân bạn đã tạo khi nhận vai trò. Việc ghép khoá và giải mã diễn ra ngay trên
          trình duyệt này — PICO không đọc được nội dung.
        </Typography.Paragraph>
        <PassphraseForm
          submitText="Mở hộp nhận"
          hint="Có thể mất vài giây."
          onSubmit={async (pass, setProgress) => {
            const opened = await openInboxWithPassphrase(trusteeId, keyring.data, pass, setProgress);
            setInbox(trusteeId, opened);
          }}
        />
        <Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingLeft: 0, marginTop: 16 }} onClick={() => navigate('/')}>
          Về trang chính
        </Button>
        <LegalNotice style={{ marginTop: 16 }} />
      </Card>
    );

  const letter = inbox.grant.letter?.trim();

  // a) Thư mở đầu — hiển thị trước mọi thứ khác.
  if (letter && !inbox.letterSeen)
    return <LetterScreen ownerName={inbox.ownerName} letter={letter} onContinue={() => markLetterSeen(trusteeId)} />;

  const decrypted = inbox.items.flatMap((i) => (i.data ? [{ id: i.id, data: i.data }] : []));

  return (
    <>
      <Flex justify="space-between" align="center" wrap gap={8} className="no-print" style={{ marginBottom: 16 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>Trang chính</Button>
        <Flex gap={8}>
          <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Xuất PDF</Button>
          <Button icon={<LockOutlined />} onClick={() => { lock(); navigate('/'); }}>Khoá lại</Button>
        </Flex>
      </Flex>

      <Typography.Title level={2} style={{ marginTop: 0 }}>Phần {inbox.ownerName} để lại cho bạn</Typography.Title>
      <Typography.Paragraph type="secondary">
        Hồ sơ mở lúc {formatDateTime(inbox.releasedAt)} · {inbox.items.length} hạng mục
      </Typography.Paragraph>

      {letter && (
        <Card style={{ marginBottom: 24 }} title="Thư mở đầu"
          extra={<Button type="link" className="no-print" onClick={() => markLetterSeen(trusteeId, false)}>Đọc toàn màn hình</Button>}>
          <div className="letter-body" style={{ fontSize: 17 }}>{letter}</div>
        </Card>
      )}

      <AssetMap items={decrypted} />
      <Checklist trusteeId={trusteeId} items={decrypted} />
      <ItemDetails items={inbox.items} />

      <LegalNotice style={{ marginTop: 24 }} />
    </>
  );
}
