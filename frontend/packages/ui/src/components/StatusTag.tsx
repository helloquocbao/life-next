import { Tag } from 'antd';

/**
 * Tag hiển thị nhãn + màu cho một giá trị enum, tra theo cặp bảng label/color dùng chung ở `labels.ts`
 * (VD `trusteeStatusLabel`/`trusteeStatusColor`, `releaseStatusLabel`/`releaseStatusColor`…).
 * Gom về một chỗ để nhãn và màu luôn đi cùng nhau — tránh trường hợp một nơi tự viết `<Tag>` tay và
 * quên đồng bộ khi bảng label/color đổi (đã từng xảy ra: ConsentSection.tsx tự suy màu tay, lệch với
 * `contactResponseLabel` dùng ở nơi khác).
 */
export function StatusTag<T extends string | number>({ value, label, color }: {
  value: T;
  label: Record<T, string>;
  color?: Record<T, string>;
}) {
  return <Tag color={color?.[value]}>{label[value]}</Tag>;
}
