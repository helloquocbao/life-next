/**
 * Giai đoạn "Bình thường": owner vẫn check-in đều (hoặc mới trễ nhẹ — trustee chưa được báo).
 * Chỉ một thông điệp lớn: "Bạn không cần làm gì". Kèm vài con số và phần "Chuẩn bị trước" để đọc
 * lúc bình tĩnh — dễ hơn nhiều so với đọc lúc khủng hoảng.
 */
import { Collapse, Descriptions, Tag, Typography } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import { TrusteeRole, type AssignmentDto } from '@deathnote/api';
import { colors } from '@deathnote/ui';
import { roleHint, roleLabel } from '../../lib/labels';

export function NormalPhase({ a }: { a: AssignmentDto }) {
  const isKeyHolder = a.role === TrusteeRole.KeyHolder;
  return (
    <>
      <p className="lead" style={{ color: colors.primary }}>
        <CheckCircleFilled style={{ marginRight: 10 }} />
        Mọi thứ bình thường. Bạn không cần làm gì.
      </p>

      <Descriptions column={1} size="middle" style={{ marginTop: 20 }}
        items={[
          { key: 'role', label: 'Vai trò của bạn', children: <span>{roleLabel(a.role)}<div className="muted" style={{ fontSize: 14 }}>{roleHint(a.role)}</div></span> },
          { key: 'others', label: 'Người được uỷ quyền khác', children: `${a.otherTrusteeCount ?? 0} người` },
          { key: 'items', label: 'Hạng mục được phân cho bạn', children: `${a.grantItemCount ?? 0} hạng mục (nội dung chỉ mở khi cần)` },
          ...(isKeyHolder
            ? [{
                key: 'share', label: 'Mảnh khoá',
                children: a.hasKeyShare
                  ? <Tag color="green">Bạn đã giữ mảnh khoá</Tag>
                  : <Tag color="gold">Chưa nhận — người uỷ quyền sẽ phân khoá sau</Tag>,
              }]
            : []),
        ]}
      />

      <Collapse ghost style={{ marginTop: 8 }}
        items={[{
          key: 'prepare',
          label: <Typography.Text strong>Chuẩn bị trước: nếu một ngày cần đến, mọi việc diễn ra thế nào?</Typography.Text>,
          children: (
            <ol style={{ paddingLeft: 20, margin: 0, lineHeight: 1.7 }}>
              <li>Nếu {a.ownerName} ngừng check-in, hệ thống nhắc họ nhiều lần trước. Bạn chưa được báo gì ở bước này.</li>
              <li>Nếu vẫn im lặng, bạn nhận thông báo: "Bạn có liên lạc được không?". Phần lớn trường hợp chỉ là quên — một cuộc gọi là đủ.</li>
              <li>Hết thời gian ân hạn, một người được uỷ quyền có thể khởi tạo yêu cầu mở và nộp bằng chứng.</li>
              <li>Cần đủ số người giữ khoá cùng đồng ý; sau đó 2 người thẩm định của PICO kiểm tra hồ sơ.</li>
              <li>Tiếp theo là thời gian chờ cuối 48–72 giờ. {a.ownerName} có thể huỷ ở bất kỳ bước nào trước khi mở.</li>
              <li>Khi được mở, bạn nhập passphrase để mở phần được giao ngay trên trình duyệt — PICO không đọc được nội dung.</li>
            </ol>
          ),
        }]}
      />
    </>
  );
}
