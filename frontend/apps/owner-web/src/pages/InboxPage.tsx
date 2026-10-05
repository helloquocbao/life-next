/**
 * Hộp nhận — nơi người nhận xem phần owner để lại. Thứ tự hiển thị có chủ đích:
 *   0) Tự động mở & giải mã NGAY TRÊN TRÌNH DUYỆT (xem lib/inbox.ts) — không cần passphrase hay khoá cá nhân.
 *   a) Thư mở đầu — toàn màn hình, trước mọi thứ khác.
 *   b) Bản đồ tài sản (số lượng theo loại) → c) Checklist việc cần làm → d) Chi tiết hạng mục → e) Xuất PDF.
 *
 * Nội dung đã giải mã chỉ ở trong bộ nhớ (zustand), không ghi xuống storage.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button, Card, Flex, Spin, Typography } from 'antd';
import { ArrowLeftOutlined, LockOutlined, PrinterOutlined } from '@ant-design/icons';
import { ErrorAlert, LegalNotice, formatDateTime } from '@deathnote/ui';
import { openInboxFor } from '../lib/inbox';
import { useInboxSession } from '../session/inboxSession';
import { LetterScreen } from './inbox/LetterScreen';
import { AssetMap } from './inbox/AssetMap';
import { Checklist } from './inbox/Checklist';
import { ItemDetails } from './inbox/ItemDetails';

export function InboxPage() {
  const { trusteeId = '' } = useParams();
  const navigate = useNavigate();
  const inbox = useInboxSession((s) => s.inboxes[trusteeId]);
  const setInbox = useInboxSession((s) => s.setInbox);
  const markLetterSeen = useInboxSession((s) => s.markLetterSeen);
  const lock = useInboxSession((s) => s.lock);
  const [progress, setProgress] = useState('Đang mở phần dành cho bạn…');
  const [error, setError] = useState<unknown>();
  const started = useRef(false);

  const load = useCallback(async () => {
    setError(undefined);
    try {
      setInbox(trusteeId, await openInboxFor(trusteeId, setProgress));
    } catch (e) {
      setError(e);
    }
  }, [trusteeId, setInbox]);

  // Chưa mở trong phiên này → tự mở (StrictMode gọi effect 2 lần ở dev nên chặn bằng ref).
  useEffect(() => {
    if (inbox || started.current) return;
    started.current = true;
    void load();
  }, [inbox, load]);

  if (!inbox)
    return (
      <div className="page-trustee">
        <Card>
          <Typography.Title level={3} style={{ marginTop: 0 }}>Phần được để lại cho bạn</Typography.Title>
          {error ? (
            <>
              <ErrorAlert error={error} />
              <Flex gap={8} style={{ marginTop: 16 }}>
                <Button type="primary" onClick={() => void load()}>Thử lại</Button>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/assignments')}>Quay lại</Button>
              </Flex>
            </>
          ) : (
            <Flex align="center" gap={12} style={{ padding: '12px 0' }}>
              <Spin />
              <Typography.Text>{progress}</Typography.Text>
            </Flex>
          )}
          <Typography.Paragraph type="secondary" style={{ marginTop: 12, fontSize: 13 }}>
            Việc giải mã diễn ra ngay trên trình duyệt này.
          </Typography.Paragraph>
          <LegalNotice style={{ marginTop: 16 }} />
        </Card>
      </div>
    );

  const letter = inbox.grant.letter?.trim();

  // a) Thư mở đầu — hiển thị trước mọi thứ khác.
  if (letter && !inbox.letterSeen)
    return <LetterScreen ownerName={inbox.ownerName} letter={letter} onContinue={() => markLetterSeen(trusteeId)} />;

  const decrypted = inbox.items.flatMap((i) => (i.data ? [{ id: i.id, data: i.data }] : []));

  return (
    <div className="page-trustee">
      <Flex justify="space-between" align="center" wrap gap={8} className="no-print" style={{ marginBottom: 16 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/assignments')}>Hồ sơ tôi giữ giúp</Button>
        <Flex gap={8}>
          <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Xuất PDF</Button>
          <Button icon={<LockOutlined />} onClick={() => { lock(); navigate('/assignments'); }}>Khoá lại</Button>
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
    </div>
  );
}
