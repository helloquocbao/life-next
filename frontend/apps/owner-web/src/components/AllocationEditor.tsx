import { useMemo } from 'react';
import { Button, Checkbox, Drawer, Input, List, Space, Typography } from 'antd';
import type { TrusteeDto } from '@deathnote/api';
import { kindDef } from '../lib/itemKinds';
import type { DecryptedItem } from '../lib/useDecryptedItems';

/**
 * Hộp thoại chọn thông tin cho MỘT người — thay cho ma trận hạng mục × người nhận trên một bảng.
 * Mỗi lần chỉ làm việc với một người, danh sách hạng mục hiện theo cột dọc dễ đọc, dễ chạm.
 */
export function AllocationEditor({ trustee, items, selectedIds, letter, onToggle, onLetterChange, onClose }: {
  trustee: TrusteeDto;
  items: DecryptedItem[];
  selectedIds: string[];
  letter: string;
  onToggle: (itemId: string, on: boolean) => void;
  onLetterChange: (text: string) => void;
  onClose: () => void;
}) {
  const sorted = useMemo(() => [...items].sort((a, b) => a.data.kind.localeCompare(b.data.kind)), [items]);
  const selected = new Set(selectedIds);

  // Dùng Drawer thay vì Modal: nhiều chỗ hơn cho danh sách dài, dễ thao tác trên màn hình nhỏ.
  return (
    <Drawer open onClose={onClose} title={`Chọn thông tin cho ${trustee.displayName}`} size="large"
      extra={<Button type="primary" onClick={onClose}>Xong</Button>}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Typography.Text strong style={{ fontSize: 15 }}>Thông tin muốn gửi cho {trustee.displayName}</Typography.Text>
          <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Chỉ tích những mục bạn muốn người này nhận.</div>
          {sorted.length === 0 ? (
            <Typography.Text type="secondary">Bạn chưa lưu thông tin nào. Vào mục "Két thông tin" hoặc "Tài sản & quyền lợi" để thêm.</Typography.Text>
          ) : (
            <List bordered dataSource={sorted} renderItem={(it) => (
              <List.Item style={{ cursor: 'pointer' }} onClick={() => onToggle(it.id, !selected.has(it.id))}>
                {/* stopPropagation: nếu không, bấm vào chính ô tích/nhãn sẽ bật rồi lại tắt (click nổi bọt lên List.Item lần 2). */}
                <Checkbox checked={selected.has(it.id)} onChange={(e) => onToggle(it.id, e.target.checked)} onClick={(e) => e.stopPropagation()} style={{ width: '100%' }}>
                  <span style={{ fontSize: 16 }}>{kindDef(it.data.kind).emoji} {it.data.title}</span>
                </Checkbox>
              </List.Item>
            )} />
          )}
        </div>
        <div>
          <Typography.Text strong style={{ fontSize: 15 }}>Thư riêng (không bắt buộc)</Typography.Text>
          <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Điều đầu tiên {trustee.displayName} sẽ đọc khi thông tin được mở.</div>
          <Input.TextArea rows={6} value={letter} onChange={(e) => onLetterChange(e.target.value)}
            placeholder={`Ví dụ: "Gửi ${trustee.displayName}, mẹ để lại vài điều con cần biết…"`} />
        </div>
      </Space>
    </Drawer>
  );
}
