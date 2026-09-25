/**
 * KHU VỰC BỎ PHIẾU — dính ở footer của drawer.
 *
 * Quy tắc 4 mắt (backend thực thi, frontend chỉ phản ánh):
 * - Phiếu 1 (thẩm định) cần quyền Review; phiếu 2 (phê duyệt) cần quyền Approve; một người không bỏ cả 2 phiếu cùng vòng.
 * - Super admin KHÔNG được bỏ phiếu (tách quyền quản trị hệ thống khỏi quyền quyết định trên dữ liệu khách hàng).
 * - `myVoteStage` = 0 → hiển thị lý do bị chặn (`myVoteBlockedReason`) thay cho các nút.
 *
 * Ràng buộc nhập liệu: "Yêu cầu bổ sung" và "Từ chối" BẮT BUỘC có ghi chú (trustee sẽ đọc lý do / phục vụ kiểm toán).
 * "Duyệt" ở phiếu 2 là bước đưa hồ sơ vào thời gian chờ cuối → luôn có Modal xác nhận nhắc rằng owner vẫn huỷ được.
 */
import { useState } from 'react';
import { Alert, App, Button, Input, Space, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, InfoCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { ReviewDecision, type ReleaseCaseDto } from '@deathnote/api';
import { ErrorAlert, reviewDecisionLabel } from '@deathnote/ui';
import { useCastVote } from '../../lib/api-hooks';

const NOTE_MAX = 2000; // khớp [StringLength(2000)] của CastVoteInput.Note

export function VotePanel({ data, finalWaitHours }: { data: ReleaseCaseDto; finalWaitHours?: number }) {
  const { modal, message } = App.useApp();
  const vote = useCastVote(data.id!);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState(false);
  const stage = data.myVoteStage ?? 0;

  if (stage === 0)
    return (
      <Alert type="info" showIcon icon={<InfoCircleOutlined />}
        title={data.myVoteBlockedReason || 'Bạn không có phiếu nào cần bỏ cho hồ sơ này.'} />
    );

  const finalWaitText = finalWaitHours ? `${finalWaitHours} giờ` : '48–72 giờ theo chính sách';

  const submit = (decision: ReviewDecision) => {
    const trimmed = note.trim();
    if (decision !== ReviewDecision.Approve && !trimmed) {
      setNoteError(true);
      message.warning('Vui lòng nhập ghi chú lý do cho quyết định này.');
      return;
    }
    const run = () =>
      vote.mutateAsync({ decision, note: trimmed || null }).then(() => {
        message.success(`Đã ghi nhận phiếu "${reviewDecisionLabel[decision]}".`);
        setNote('');
        setNoteError(false);
      });

    // Mọi phiếu đều không thể rút lại → xác nhận trước khi gửi, nội dung nhấn mạnh hệ quả của từng quyết định.
    if (decision === ReviewDecision.Approve && stage === 2) {
      modal.confirm({
        title: 'Xác nhận phê duyệt mở vault (phiếu 2)',
        width: 520,
        content: (
          <div>
            <p>Đây là phiếu cuối cùng. Sau khi duyệt, <b>hồ sơ sẽ vào thời gian chờ cuối {finalWaitText}</b>.</p>
            <p><b>Owner vẫn có thể huỷ</b> trong suốt thời gian này bằng một lần check-in. Hết thời gian chờ, người được uỷ quyền mới nhận được mảnh khoá để tự giải mã.</p>
            <p style={{ marginBottom: 0 }}>Bạn đã đối chiếu đầy đủ bằng chứng và cờ rủi ro?</p>
          </div>
        ),
        okText: 'Phê duyệt',
        cancelText: 'Xem lại',
        onOk: () => run().catch(() => undefined), // lỗi hiển thị qua ErrorAlert bên dưới
      });
      return;
    }
    modal.confirm({
      title: decision === ReviewDecision.Approve ? 'Xác nhận phiếu thẩm định: Duyệt'
        : decision === ReviewDecision.Reject ? 'Xác nhận từ chối yêu cầu mở' : 'Xác nhận yêu cầu bổ sung bằng chứng',
      content: decision === ReviewDecision.Approve
        ? 'Hồ sơ sẽ chuyển sang chờ phiếu phê duyệt do một người khác thực hiện.'
        : decision === ReviewDecision.Reject
          ? 'Yêu cầu mở sẽ bị đóng. Người được uỷ quyền phải khởi tạo lại nếu muốn tiếp tục.'
          : 'Người được uỷ quyền sẽ nhận ghi chú của bạn và nộp thêm bằng chứng; hồ sơ sẽ vào vòng thẩm định mới.',
      okText: 'Xác nhận',
      cancelText: 'Huỷ',
      okButtonProps: { danger: decision === ReviewDecision.Reject },
      onOk: () => run().catch(() => undefined),
    });
  };

  return (
    <div>
      <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>
        Bạn đang bỏ phiếu {stage === 1 ? '1: thẩm định' : '2: phê duyệt'} (vòng {data.reviewRound ?? 1})
      </Typography.Text>
      <Input.TextArea value={note} rows={2} maxLength={NOTE_MAX} showCount status={noteError ? 'error' : undefined}
        placeholder="Ghi chú (bắt buộc khi Yêu cầu bổ sung hoặc Từ chối)"
        onChange={(e) => { setNote(e.target.value); if (e.target.value.trim()) setNoteError(false); }} />
      <ErrorAlert error={vote.error} style={{ marginTop: 8 }} />
      <Space style={{ marginTop: 12, justifyContent: 'flex-end', width: '100%' }} wrap>
        <Button danger icon={<CloseOutlined />} disabled={vote.isPending} onClick={() => submit(ReviewDecision.Reject)}>Từ chối</Button>
        <Button icon={<QuestionCircleOutlined />} disabled={vote.isPending} onClick={() => submit(ReviewDecision.RequestMoreInfo)}>Yêu cầu bổ sung</Button>
        <Button type="primary" icon={<CheckOutlined />} loading={vote.isPending} onClick={() => submit(ReviewDecision.Approve)}>Duyệt</Button>
      </Space>
    </div>
  );
}
