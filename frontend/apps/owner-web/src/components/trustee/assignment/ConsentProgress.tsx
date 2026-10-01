/**
 * Tiến độ đồng thuận trực quan: "{effective}/{required} người đã đồng ý — cần thêm {n}".
 * Chỉ số "hiệu lực" có thể thấp hơn số lượt đồng ý nếu hệ thống bật kiểm tra khác thiết bị/mạng.
 */
import { Flex, List, Progress, Tag, Typography } from 'antd';
import type { ReleaseProgressDto } from '@deathnote/api';
import { colors, formatDateTime } from '@deathnote/ui';

export function ConsentProgress({ r }: { r: ReleaseProgressDto }) {
  const required = r.requiredConsents ?? 0;
  const effective = r.effectiveConsents ?? 0;
  const missing = Math.max(0, required - effective);
  const consents = r.consents ?? [];
  const percent = required > 0 ? Math.min(100, Math.round((effective / required) * 100)) : 0;

  return (
    <Flex gap={24} align="center" wrap>
      <Progress type="circle" percent={percent} size={140} strokeColor={colors.primary}
        format={() => <span style={{ fontSize: 28, fontWeight: 700, color: colors.ink }}>{effective}/{required}</span>} />
      <div style={{ flex: 1, minWidth: 220 }}>
        <p className="lead" style={{ fontSize: 20 }}>
          {missing > 0 ? `${effective}/${required} người đã đồng ý — cần thêm ${missing}` : `Đã đủ ${required} người đồng ý`}
        </p>
        {r.haveIConsented && <Tag color="green" style={{ marginTop: 8 }}>Bạn đã đồng ý</Tag>}
        {consents.length > 0 && (
          <List size="small" style={{ marginTop: 8 }} dataSource={consents}
            renderItem={(c) => (
              <List.Item style={{ paddingLeft: 0 }}>
                <Typography.Text>{c.trusteeName}</Typography.Text>
                <Typography.Text type="secondary">{formatDateTime(c.consentedAt)}</Typography.Text>
              </List.Item>
            )} />
        )}
        {consents.length > effective && (
          <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginTop: 8 }}>
            Một số lượt đồng ý từ cùng thiết bị/mạng chỉ được tính một lần để bảo đảm an toàn.
          </Typography.Paragraph>
        )}
      </div>
    </Flex>
  );
}
