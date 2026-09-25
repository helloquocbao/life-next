/**
 * Nộp tệp bằng chứng cho yêu cầu mở: chọn loại (giấy chứng tử, giấy nhập viện…) rồi chọn tệp (≤ 10 MB).
 * Tệp lưu ở kho riêng, chỉ người thẩm định của PICO xem được và tự xoá sau khi đóng hồ sơ.
 */
import { useState } from 'react';
import { App, Button, Flex, Select, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { EvidenceKind } from '@deathnote/api';
import { ErrorAlert, evidenceKindLabel, formatBytes } from '@deathnote/ui';
import { MAX_EVIDENCE_BYTES } from '../config';
import { useUploadEvidence } from '../lib/api-hooks';

const kindOptions = (Object.values(EvidenceKind) as EvidenceKind[]).map((k) => ({ value: k, label: evidenceKindLabel[k] }));

export function EvidenceUploader({ requestId }: { requestId: string }) {
  const { message } = App.useApp();
  const [kind, setKind] = useState<EvidenceKind>(EvidenceKind.DeathCertificate);
  const upload = useUploadEvidence();

  const onPick = (file: File) => {
    if (file.size > MAX_EVIDENCE_BYTES) {
      message.error(`Tệp ${formatBytes(file.size)} vượt quá giới hạn 10 MB.`);
      return Upload.LIST_IGNORE;
    }
    upload.mutate(
      { requestId, kind, file },
      { onSuccess: () => message.success(`Đã nộp "${file.name}".`) },
    );
    return false; // tự xử lý tải lên, không để AntD tự gửi
  };

  return (
    <>
      <Flex gap={8} wrap>
        <Select value={kind} onChange={setKind} options={kindOptions} style={{ minWidth: 220, flex: 1 }} aria-label="Loại bằng chứng" />
        <Upload beforeUpload={onPick} showUploadList={false} accept="image/*,application/pdf" maxCount={1}>
          <Button icon={<UploadOutlined />} loading={upload.isPending}>Chọn tệp (≤ 10 MB)</Button>
        </Upload>
      </Flex>
      <ErrorAlert error={upload.error} style={{ marginTop: 12 }} />
    </>
  );
}
