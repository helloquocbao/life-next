/**
 * Giai đoạn "Bình thường": owner vẫn check-in đều. Chỉ một thông điệp lớn: "Bạn không cần làm gì". Kèm vài thông tin
 * và phần "Chuẩn bị trước" để đọc lúc bình tĩnh — dễ hơn nhiều so với đọc lúc khủng hoảng.
 */
import { Collapse, Descriptions, Tag, Typography } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import { TrusteeRole, type AssignmentDto } from '@deathnote/api';
import { colors } from '@deathnote/ui';
import { roleHint, roleLabel } from '../../../lib/trusteeLabels';

export function NormalPhase({ a }: { a: AssignmentDto }) {
  const isRecipient = a.role === TrusteeRole.Recipient;
  return (
    <>
      <p className="lead" style={{ color: colors.primary }}>
        <CheckCircleFilled style={{ marginRight: 10 }} />
        Mọi thứ bình thường. Bạn không cần làm gì.
      </p>

      <Descriptions column={1} size="middle" style={{ marginTop: 20 }}
        items={[
          { key: 'role', label: 'Vai trò của bạn', children: <span>{roleLabel(a.role)}<div className="muted" style={{ fontSize: 14 }}>{roleHint(a.role)}</div></span> },
          ...(isRecipient
            ? [{
                key: 'grant', label: 'Phần dành cho bạn',
                children: a.hasGrant
                  ? <Tag color="green">{a.ownerName} đã chuẩn bị {a.grantItemCount} hạng mục (nội dung chỉ mở khi cần)</Tag>
                  : <Tag color="gold">{a.ownerName} chưa chọn thông tin cho bạn</Tag>,
              }]
            : []),
        ]}
      />

      <Collapse ghost style={{ marginTop: 8 }}
        items={[{
          key: 'prepare',
          label: <Typography.Text strong>Chuẩn bị trước: nếu một ngày cần đến, mọi việc diễn ra thế nào?</Typography.Text>,
          children: isRecipient ? (
            <ol style={{ paddingLeft: 20, margin: 0, lineHeight: 1.7 }}>
              <li>Nếu {a.ownerName} ngừng xác nhận "tôi vẫn ổn", hệ thống nhắc họ nhiều lần trước. Bạn không được báo gì ở bước này.</li>
              <li>Nếu họ vẫn im lặng, người nhắc nhở của {a.ownerName} được báo để liên lạc với họ. Phần lớn trường hợp chỉ là quên.</li>
              <li>Nếu hết thời gian chờ mà {a.ownerName} vẫn không phản hồi, bạn nhận email kèm link để xem phần họ để lại.</li>
              <li>Bạn bấm link trong email, tạo một mật khẩu (nếu chưa có tài khoản) rồi xem phần của mình — giải mã ngay trên trình duyệt của bạn.</li>
              <li>{a.ownerName} có thể huỷ bất cứ lúc nào trước bước 3 chỉ bằng một lần bấm.</li>
            </ol>
          ) : (
            <ol style={{ paddingLeft: 20, margin: 0, lineHeight: 1.7 }}>
              <li>Nếu {a.ownerName} ngừng xác nhận "tôi vẫn ổn", hệ thống nhắc họ nhiều lần trước. Bạn chưa được báo gì ở bước này.</li>
              <li>Nếu họ vẫn im lặng, bạn là người được báo trước tiên, kèm số ngày còn lại.</li>
              <li>Việc của bạn: gọi điện hoặc nhắn tin, nhắc {a.ownerName} mở ứng dụng bấm "Tôi vẫn ổn". Phần lớn trường hợp chỉ là quên.</li>
              <li>Nếu hết thời gian chờ mà họ vẫn không bấm, thông tin họ chuẩn bị sẽ tự động được gửi cho người nhận. Bạn không nhận và không xem được thông tin nào.</li>
            </ol>
          ),
        }]}
      />
    </>
  );
}
