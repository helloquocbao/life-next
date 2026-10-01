/**
 * "Nhật ký liên quan đến tôi": các sự kiện gắn với chính trustee này + các bước của quy trình mở.
 * Minh bạch giúp người thân yên tâm rằng không ai làm gì sau lưng họ.
 */
import { Drawer, Empty, Timeline, Typography } from 'antd';
import { ErrorAlert, FullPageSpin, auditActionLabel, formatDateTime } from '@deathnote/ui';
import { useActivity } from '../lib/api-hooks';

export function ActivityDrawer({ trusteeId, open, onClose }: { trusteeId: string; open: boolean; onClose: () => void }) {
  const q = useActivity(trusteeId, open);

  return (
    <Drawer title="Nhật ký liên quan đến tôi" open={open} onClose={onClose} size="large">
      {q.isLoading && <FullPageSpin />}
      <ErrorAlert error={q.error} />
      {q.data && q.data.length === 0 && <Empty description="Chưa có sự kiện nào." />}
      {q.data && q.data.length > 0 && (
        <Timeline
          items={q.data.map((e) => ({
            key: e.sequence,
            content: (
              <>
                <Typography.Text strong>{auditActionLabel[e.action ?? ''] ?? e.action}</Typography.Text>
                <div className="muted" style={{ fontSize: 14 }}>
                  {formatDateTime(e.occurredAt)}{e.actorName ? ` · ${e.actorName}` : ''}
                </div>
                {e.detail && <div style={{ fontSize: 14 }}>{e.detail}</div>}
              </>
            ),
          }))}
        />
      )}
    </Drawer>
  );
}
