/**
 * KHỐI 4 — Bằng chứng (giấy chứng tử, giấy nhập viện, CCCD, bản khai…).
 *
 * - Chỉ vai trò có quyền `DeathNote.Releases.Evidence` được xem/tải (Support KHÔNG có) — backend trả `canViewEvidence`.
 * - Mỗi lượt xem/tải đều ghi audit (ai, lúc nào, tệp nào) để phục vụ kiểm toán quyền riêng tư.
 * - Bằng chứng tự xoá sau thời hạn lưu trữ (`purgedAt`) — chỉ còn metadata.
 */
import { useState } from 'react';
import { App, Button, Space, Table, Tag, Typography, type TableColumnsType } from 'antd';
import { DownloadOutlined, EyeOutlined, LockOutlined } from '@ant-design/icons';
import type { EvidenceKind } from '@deathnote/api';
import { errorMessage, evidenceKindLabel, formatBytes, formatDateTime } from '@deathnote/ui';
import { fetchEvidenceBlob, previewKind, saveBlob } from '../../lib/evidence';
import type { CaseEvidenceDto } from '../../lib/types';
import { EvidencePreviewModal } from './EvidencePreviewModal';

export function EvidenceSection({ evidence, canView }: { evidence: CaseEvidenceDto[]; canView: boolean }) {
  const { message } = App.useApp();
  const [preview, setPreview] = useState<CaseEvidenceDto | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const download = async (e: CaseEvidenceDto) => {
    if (!e.id) return;
    setDownloading(e.id);
    try {
      saveBlob(await fetchEvidenceBlob(e.id), e.fileName || 'bang-chung');
    } catch (err) {
      message.error(errorMessage(err));
    } finally {
      setDownloading(null);
    }
  };

  const columns: TableColumnsType<CaseEvidenceDto> = [
    { title: 'Loại', dataIndex: 'kind', width: 140, render: (v: EvidenceKind) => <Tag>{evidenceKindLabel[v]}</Tag> },
    { title: 'Tên tệp', dataIndex: 'fileName', ellipsis: true },
    { title: 'Dung lượng', dataIndex: 'sizeBytes', width: 90, render: (v: number) => formatBytes(v) },
    { title: 'Người nộp', dataIndex: 'uploadedBy', width: 120 },
    { title: 'Thời điểm', dataIndex: 'uploadedAt', width: 130, render: (v: string) => formatDateTime(v) },
    {
      title: 'Đã tự xoá?', dataIndex: 'purgedAt', width: 110,
      render: (v?: string | null) => v ? <Tag color="default">Đã xoá {formatDateTime(v)}</Tag> : <Typography.Text type="secondary">Chưa</Typography.Text>,
    },
  ];
  if (canView)
    columns.push({
      title: 'Thao tác', key: 'actions', width: 130, fixed: 'right',
      render: (_, e) => e.purgedAt ? <Typography.Text type="secondary">—</Typography.Text> : (
        <Space size={4}>
          {previewKind(e.contentType) && <Button size="small" icon={<EyeOutlined />} onClick={() => setPreview(e)}>Xem</Button>}
          <Button size="small" icon={<DownloadOutlined />} loading={downloading === e.id} onClick={() => void download(e)}>Tải</Button>
        </Space>
      ),
    });

  return (
    <>
      {canView ? (
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>
          <LockOutlined /> Mỗi lượt xem hoặc tải tệp đều được ghi vào audit log (người xem, thời điểm, tên tệp).
        </Typography.Paragraph>
      ) : (
        <Typography.Paragraph type="warning" style={{ fontSize: 13, marginBottom: 8 }}>
          <LockOutlined /> Vai trò của bạn không được xem giấy tờ bằng chứng.
        </Typography.Paragraph>
      )}
      <Table<CaseEvidenceDto> size="small" rowKey={(e) => e.id ?? ''} columns={columns} dataSource={evidence}
        pagination={false} scroll={{ x: 820 }} locale={{ emptyText: 'Chưa có tài liệu bằng chứng' }} />
      <EvidencePreviewModal evidence={preview} onClose={() => setPreview(null)} />
    </>
  );
}
