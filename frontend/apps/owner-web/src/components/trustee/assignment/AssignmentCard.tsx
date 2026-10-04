/**
 * Một hồ sơ mà người dùng được owner giao vai trò. Nội dung đổi theo VAI TRÒ và GIAI ĐOẠN — mỗi lúc chỉ một việc:
 *
 *   Người nhắc nhở:       Bình thường → (owner im lặng) Cảnh báo: liên lạc & nhắc owner bấm nút → Đã bàn giao.
 *   Người nhận thông tin: Bình thường (không được báo gì) → (hết ân hạn) Đã bàn giao: mở hộp nhận.
 */
import { useState } from 'react';
import { Button, Card, Typography } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { TrusteePhase, TrusteeRole, type AssignmentDto } from '@deathnote/api';
import { roleLabel } from '../../../lib/trusteeLabels';
import { ActivityDrawer } from '../ActivityDrawer';
import { AlertPhase } from './AlertPhase';
import { NormalPhase } from './NormalPhase';
import { ReleasedPhase } from './ReleasedPhase';

export function AssignmentCard({ a }: { a: AssignmentDto }) {
  const [activityOpen, setActivityOpen] = useState(false);
  const trusteeId = a.trusteeId ?? '';

  return (
    <Card
      style={{ marginBottom: 24 }}
      title={
        <div style={{ padding: '8px 0', whiteSpace: 'normal' }}>
          <Typography.Text style={{ fontSize: 18 }}>{a.ownerName}</Typography.Text>
          <div className="muted" style={{ fontSize: 14, fontWeight: 400 }}>
            {roleLabel(a.role)}{a.relationship ? ` · ${a.relationship}` : ''}
          </div>
        </div>
      }
    >
      {a.phase === TrusteePhase.Normal && <NormalPhase a={a} />}
      {a.phase === TrusteePhase.Alert && a.role === TrusteeRole.Reminder && <AlertPhase a={a} />}
      {a.phase === TrusteePhase.Released && <ReleasedPhase a={a} />}

      <Button type="link" icon={<HistoryOutlined />} style={{ paddingLeft: 0, marginTop: 16 }} onClick={() => setActivityOpen(true)}>
        Nhật ký liên quan đến tôi
      </Button>
      {trusteeId && <ActivityDrawer trusteeId={trusteeId} open={activityOpen} onClose={() => setActivityOpen(false)} />}
    </Card>
  );
}
