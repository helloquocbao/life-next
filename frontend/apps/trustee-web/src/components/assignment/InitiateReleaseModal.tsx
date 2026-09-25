/**
 * Khởi tạo yêu cầu mở hồ sơ — hai bước trong cùng một modal:
 *   1) Lý do + lời khai (người khai chịu trách nhiệm pháp lý — phải tick xác nhận).
 *   2) Nộp bằng chứng ngay (có thể bỏ qua và nộp sau ở màn hình tiến độ).
 *
 * Modal được giữ ở cấp AssignmentCard để không bị đóng khi card chuyển từ "Cảnh báo" sang "Đang xác minh".
 */
import { useState } from 'react';
import { App, Button, Checkbox, Form, Input, Modal, Radio, Typography } from 'antd';
import { ReleaseReason } from '@deathnote/api';
import { ErrorAlert, LegalNotice, releaseReasonLabel } from '@deathnote/ui';
import { useInitiateRelease } from '../../lib/api-hooks';
import { EvidenceUploader } from '../EvidenceUploader';

type Values = { reason: ReleaseReason; statement: string; confirm: boolean };

const reasons = Object.values(ReleaseReason) as ReleaseReason[];

export function InitiateReleaseModal({ trusteeId, ownerName, open, onClose }: {
  trusteeId: string; ownerName: string; open: boolean; onClose: () => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const initiate = useInitiateRelease();
  const [requestId, setRequestId] = useState<string>();

  const close = () => {
    form.resetFields();
    initiate.reset();
    setRequestId(undefined);
    onClose();
  };

  const finish = (v: Values) =>
    initiate.mutate(
      { trusteeId, reason: v.reason, statement: v.statement.trim() },
      {
        onSuccess: (r) => {
          message.success('Đã khởi tạo yêu cầu mở. Những người được uỷ quyền khác sẽ được thông báo.');
          setRequestId(r.id);
        },
      },
    );

  return (
    <Modal open={open} onCancel={close} footer={null} width={640} destroyOnHidden maskClosable={false}
      title={requestId ? 'Nộp bằng chứng' : 'Khởi tạo yêu cầu mở'}>
      {!requestId ? (
        <Form form={form} layout="vertical" onFinish={finish} requiredMark={false} disabled={initiate.isPending}
          initialValues={{ reason: ReleaseReason.LostContact }}>
          <Form.Item name="reason" label="Lý do">
            <Radio.Group options={reasons.map((r) => ({ value: r, label: releaseReasonLabel[r] }))} />
          </Form.Item>
          <Form.Item name="statement" label="Lời khai của bạn"
            extra="Mô tả ngắn: lần cuối liên lạc, bạn đã thử liên hệ những ai, bạn biết gì về tình trạng hiện tại."
            rules={[{ required: true, whitespace: true, message: 'Vui lòng viết vài dòng lời khai.' }, { max: 4000 }]}>
            <Input.TextArea rows={5} maxLength={4000} showCount />
          </Form.Item>
          <Form.Item name="confirm" valuePropName="checked"
            rules={[{ validator: (_, v: boolean) => (v ? Promise.resolve() : Promise.reject(new Error('Vui lòng xác nhận lời khai.'))) }]}>
            <Checkbox>
              Tôi xác nhận thông tin trên là đúng sự thật và chịu trách nhiệm trước pháp luật về lời khai này.
            </Checkbox>
          </Form.Item>
          <ErrorAlert error={initiate.error} style={{ marginBottom: 16 }} />
          <Button type="primary" htmlType="submit" size="large" block loading={initiate.isPending}>Gửi yêu cầu</Button>
          <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
            {ownerName} sẽ được thông báo và có thể huỷ yêu cầu bất cứ lúc nào trước khi hồ sơ được mở.
          </Typography.Paragraph>
          <LegalNotice />
        </Form>
      ) : (
        <>
          <Typography.Paragraph>
            Bằng chứng giúp PICO thẩm định nhanh hơn: giấy chứng tử, giấy nhập viện, giấy tờ tuỳ thân của bạn, hoặc bản khai có chữ ký.
            Bạn có thể nộp ngay hoặc nộp sau ở màn hình tiến độ.
          </Typography.Paragraph>
          <EvidenceUploader requestId={requestId} />
          <Button type="primary" size="large" block style={{ marginTop: 24 }} onClick={close}>Xong</Button>
        </>
      )}
    </Modal>
  );
}
