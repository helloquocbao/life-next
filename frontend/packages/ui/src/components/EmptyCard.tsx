import { Card, Empty } from 'antd';

/** Trạng thái "chưa có gì" trong một Card — thay cho việc mỗi trang tự bọc `<Card><Empty/></Card>` khác nhau. */
export function EmptyCard({ description }: { description: string }) {
  return <Card><Empty description={description} /></Card>;
}
