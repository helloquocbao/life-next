/**
 * Khu vực bằng chứng của yêu cầu mở: danh sách tệp đã nộp + nộp thêm.
 * Khi PICO yêu cầu bổ sung (NeedsMoreInfo): hiện ghi chú của người thẩm định và nút "Gửi lại hồ sơ".
 */
import { App, Alert, Button, List, Typography } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { ReleaseStatus, TrusteeRole, type ReleaseProgressDto, type TrusteeRole as Role } from '@deathnote/api';
import { ErrorAlert, evidenceKindLabel, formatBytes, formatDateTime } from '@deathnote/ui';
import { useResubmit } from '../../lib/api-hooks';
import { EvidenceUploader } from '../EvidenceUploader';

const UPLOADABLE: (ReleaseStatus | undefined)[] = [
  ReleaseStatus.AwaitingConsent, ReleaseStatus.AwaitingFirstReview, ReleaseStatus.AwaitingSecondReview, ReleaseStatus.NeedsMoreInfo,
];

export function EvidenceSection({ r, role }: { r: ReleaseProgressDto; role: Role | undefined }) {
  const { message } = App.useApp();
  const resubmit = useResubmit();
  const evidence = r.evidence ?? [];
  const canUpload = role !== TrusteeRole.ContentOnly && UPLOADABLE.includes(r.status);
  const needsInfo = r.status === ReleaseStatus.NeedsMoreInfo;

  return (
    <>
      <Typography.Title level={5} style={{ marginTop: 0 }}>Bằng chứng</Typography.Title>

      {needsInfo && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} title="PICO cần bạn bổ sung thông tin"
          description={r.infoRequestNote || 'Vui lòng nộp thêm bằng chứng rồi bấm "Gửi lại hồ sơ".'} />
      )}

      {evidence.length === 0 ? (
        <Typography.Paragraph type="secondary">Chưa có tệp nào.</Typography.Paragraph>
      ) : (
        <List size="small" dataSource={evidence} style={{ marginBottom: 12 }}
          renderItem={(e) => (
            <List.Item style={{ paddingLeft: 0 }}>
              <List.Item.Meta avatar={<FileTextOutlined style={{ fontSize: 20 }} />}
                title={e.kind !== undefined ? evidenceKindLabel[e.kind] : 'Bằng chứng'}
                description={`${e.fileName ?? ''} · ${formatBytes(e.sizeBytes)} · ${formatDateTime(e.uploadedAt)}`} />
            </List.Item>
          )} />
      )}

      {canUpload && r.id && <EvidenceUploader requestId={r.id} />}

      {needsInfo && r.id && role !== TrusteeRole.ContentOnly && (
        <>
          <Button type="primary" size="large" block style={{ marginTop: 16 }} loading={resubmit.isPending}
            onClick={() => resubmit.mutate(r.id!, { onSuccess: () => message.success('Đã gửi lại hồ sơ cho PICO thẩm định.') })}>
            Gửi lại hồ sơ
          </Button>
          <ErrorAlert error={resubmit.error} style={{ marginTop: 12 }} />
        </>
      )}
    </>
  );
}
