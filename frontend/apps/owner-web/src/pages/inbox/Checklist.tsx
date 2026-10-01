/**
 * Checklist việc cần làm — sinh tự động từ hạng mục, xếp theo mức ưu tiên (bảo hiểm, ngân hàng trước).
 * Trạng thái tích lưu vào localStorage theo trusteeId: CHỈ id + true/false, không có nội dung.
 */
import { useEffect, useMemo, useState } from 'react';
import { Card, Checkbox, Flex, Progress, Typography } from 'antd';
import type { VaultItemData } from '@deathnote/crypto';
import { buildChecklist, loadChecklist, saveChecklist } from '../../lib/itemKinds';

export function Checklist({ trusteeId, items }: { trusteeId: string; items: { id: string; data: VaultItemData }[] }) {
  const tasks = useMemo(() => buildChecklist(items), [items]);
  const [done, setDone] = useState<Record<string, boolean>>(() => loadChecklist(trusteeId));

  useEffect(() => saveChecklist(trusteeId, done), [trusteeId, done]);

  if (tasks.length === 0) return null;
  const doneCount = tasks.filter((t) => done[t.id]).length;

  return (
    <Card title="Việc cần làm" style={{ marginBottom: 24 }}
      extra={<Typography.Text type="secondary">{doneCount}/{tasks.length}</Typography.Text>}>
      <Progress percent={Math.round((doneCount / tasks.length) * 100)} showInfo={false} style={{ marginBottom: 12 }} className="no-print" />
      <Typography.Paragraph type="secondary" className="no-print">
        Không cần làm tất cả trong một ngày. Các việc được xếp theo thứ tự nên làm trước.
      </Typography.Paragraph>
      <Flex vertical gap={10}>
        {tasks.map((t) => (
          <Checkbox key={t.id} checked={!!done[t.id]} onChange={(e) => setDone((d) => ({ ...d, [t.id]: e.target.checked }))}
            style={{ fontSize: 17 }}>
            <span style={done[t.id] ? { textDecoration: 'line-through', color: '#6b7a80' } : undefined}>{t.text}</span>
          </Checkbox>
        ))}
      </Flex>
    </Card>
  );
}
