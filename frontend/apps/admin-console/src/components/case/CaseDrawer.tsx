/**
 * DRAWER CHI TIẾT HỒ SƠ (bên phải, ~62% chiều rộng) — nơi người thẩm định ra quyết định.
 *
 * Thứ tự khối được sắp đúng trình tự người duyệt cần đọc:
 *   (1) Tóm tắt quyết định → (2) Timeline → (3) Đồng thuận → (4) Bằng chứng → (5) Cờ rủi ro,
 *   sau đó là thông tin bổ trợ: metadata owner, lời khai người khởi tạo, lịch sử phiếu.
 * Footer dính: khu vực bỏ phiếu (VotePanel).
 *
 * THIẾT KẾ ZERO-KNOWLEDGE: drawer không có — và backend không cung cấp — bất kỳ cách nào xem nội dung két.
 */
import { Alert, Descriptions, Drawer, Skeleton, Space, Tag, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import type { ReleaseReason, ReleaseStatus } from '@deathnote/api';
import { ErrorAlert, colors, formatDateTime, releaseReasonLabel, releaseStatusColor, releaseStatusLabel } from '@deathnote/ui';
import { usePolicy, useProfile, useReleaseCase } from '../../lib/api-hooks';
import { hasPerm, Perm } from '../../lib/permissions';
import { Section } from './Section';
import { DecisionSummary } from './DecisionSummary';
import { CaseTimeline } from './CaseTimeline';
import { ConsentSection } from './ConsentSection';
import { EvidenceSection } from './EvidenceSection';
import { RiskFlagsSection } from './RiskFlagsSection';
import { OwnerInfo } from './OwnerInfo';
import { VoteHistory } from './VoteHistory';
import { VotePanel } from './VotePanel';

export function ZeroKnowledgeNote() {
  return (
    <div className="zk-note">
      <LockOutlined /> Thiết kế zero-knowledge: không có chức năng xem nội dung két. Server chỉ giữ dữ liệu đã mã hoá.
    </div>
  );
}

export function CaseDrawer({ caseId, onClose }: { caseId?: string; onClose: () => void }) {
  const { data, isLoading, error } = useReleaseCase(caseId);
  const { data: profile } = useProfile();
  // finalWaitHours chỉ lấy được khi có quyền Policy (Approver thường không có) → VotePanel có câu dự phòng.
  const { data: policy } = usePolicy(hasPerm(profile, Perm.Policy));

  const status = data?.status as ReleaseStatus | undefined;
  const riskFlags = data?.riskFlags ?? [];

  return (
    <Drawer
      open={!!caseId}
      onClose={onClose}
      size="62%"
      destroyOnHidden
      styles={{ body: { background: colors.adminBodyBg, padding: 16 } }}
      title={data ? (
        <Space size={8} wrap>
          <span>Hồ sơ mở vault — {data.owner?.displayName}</span>
          {status != null && <Tag color={releaseStatusColor[status]}>{releaseStatusLabel[status]}</Tag>}
        </Space>
      ) : 'Hồ sơ mở vault'}
      footer={data ? <VotePanel key={data.id} data={data} finalWaitHours={policy?.finalWaitHours} /> : null}
    >
      <ErrorAlert error={error} style={{ marginBottom: 12 }} />
      {isLoading && <Skeleton active paragraph={{ rows: 12 }} />}
      {data && (
        <>
          {/* Dải thông tin nhanh của hồ sơ */}
          <Descriptions size="small" column={{ xs: 1, md: 3 }} style={{ background: '#fff', padding: '8px 12px', borderRadius: 8, marginBottom: 12 }}
            items={[
              { key: 'reason', label: 'Lý do', children: releaseReasonLabel[(data.reason ?? 0) as ReleaseReason] },
              { key: 'initiator', label: 'Người khởi tạo', children: data.initiatorName || '—' },
              { key: 'initiatedAt', label: 'Khởi tạo lúc', children: formatDateTime(data.initiatedAt) },
              { key: 'round', label: 'Vòng / phiếu', children: `Vòng ${data.reviewRound ?? 1}${data.currentStage ? ` · chờ phiếu ${data.currentStage}/2` : ''}` },
              { key: 'sla', label: 'Hạn SLA', children: formatDateTime(data.slaDueAt) },
              {
                key: 'final', label: data.releasedAt ? 'Đã mở lúc' : 'Chờ cuối đến',
                children: formatDateTime(data.releasedAt ?? data.finalWaitUntil),
              },
            ]} />
          <div style={{ marginBottom: 12 }}><ZeroKnowledgeNote /></div>
          {data.infoRequestNote && status === 3 && (
            <Alert type="warning" showIcon title="Đã yêu cầu bổ sung" description={data.infoRequestNote} style={{ marginBottom: 12 }} />
          )}
          {data.closeNote && <Alert type="info" showIcon title="Ghi chú đóng hồ sơ" description={data.closeNote} style={{ marginBottom: 12 }} />}

          <Section index={1} title="Tóm tắt quyết định">
            <DecisionSummary summary={data.summary} riskFlags={riskFlags} />
          </Section>
          <Section index={2} title="Timeline">
            <CaseTimeline entries={data.timeline ?? []} />
          </Section>
          <Section index={3} title="Đồng thuận">
            <ConsentSection consents={data.consents ?? []} trustees={data.trustees ?? []}
              required={data.requiredConsents ?? 0} effective={data.effectiveConsents ?? 0} />
          </Section>
          <Section index={4} title={`Bằng chứng (${data.evidence?.length ?? 0})`}>
            <EvidenceSection evidence={data.evidence ?? []} canView={!!data.canViewEvidence} />
          </Section>
          <Section index={5} title={`Cờ rủi ro (${riskFlags.length})`}>
            <RiskFlagsSection flags={riskFlags} />
          </Section>

          <Section title="Thông tin owner (chỉ metadata)">
            <OwnerInfo owner={data.owner} />
          </Section>
          <Section title={`Lời khai của người khởi tạo${data.initiatorName ? ` — ${data.initiatorName}` : ''}`}>
            {data.statement
              ? <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{data.statement}</Typography.Paragraph>
              : <Typography.Text type="secondary">Không có lời khai.</Typography.Text>}
          </Section>
          <Section title="Lịch sử phiếu">
            <VoteHistory votes={data.votes ?? []} />
          </Section>
        </>
      )}
    </Drawer>
  );
}
