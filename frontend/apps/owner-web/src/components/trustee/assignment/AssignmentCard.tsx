/**
 * Một hồ sơ mà người dùng là người được uỷ quyền. Nội dung đổi theo `phase` — mỗi giai đoạn chỉ
 * một việc cần làm: Bình thường → Cảnh báo → Đang xác minh → Đã mở.
 */
import { useState } from 'react';
import { Button, Card, Typography } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { TrusteePhase, type AssignmentDto, type KeyringDto } from '@deathnote/api';
import { roleLabel } from '../../../lib/trusteeLabels';
import { ActivityDrawer } from '../ActivityDrawer';
import { AlertPhase } from './AlertPhase';
import { InitiateReleaseModal } from './InitiateReleaseModal';
import { NormalPhase } from './NormalPhase';
import { ReleasedPhase } from './ReleasedPhase';
import { VerifyingPhase } from './VerifyingPhase';

export function AssignmentCard({ a, keyring }: { a: AssignmentDto; keyring: KeyringDto | undefined }) {
  const [activityOpen, setActivityOpen] = useState(false);
  const [initiateOpen, setInitiateOpen] = useState(false);
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
      {a.phase === TrusteePhase.Alert && <AlertPhase a={a} onInitiate={() => setInitiateOpen(true)} />}
      {a.phase === TrusteePhase.Verifying && <VerifyingPhase a={a} keyring={keyring} />}
      {a.phase === TrusteePhase.Released && <ReleasedPhase a={a} />}

      <Button type="link" icon={<HistoryOutlined />} style={{ paddingLeft: 0, marginTop: 16 }} onClick={() => setActivityOpen(true)}>
        Nhật ký liên quan đến tôi
      </Button>

      {trusteeId && <ActivityDrawer trusteeId={trusteeId} open={activityOpen} onClose={() => setActivityOpen(false)} />}
      {trusteeId && (
        <InitiateReleaseModal trusteeId={trusteeId} ownerName={a.ownerName ?? ''} open={initiateOpen} onClose={() => setInitiateOpen(false)} />
      )}
    </Card>
  );
}
