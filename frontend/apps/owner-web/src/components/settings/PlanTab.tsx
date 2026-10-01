import { Card, Descriptions, Tag, Typography } from 'antd';

export function PlanTab() {
  return (
    <Card title="Gói dịch vụ">
      <Descriptions column={1} bordered>
        <Descriptions.Item label="Gói hiện tại"><Tag color="green">Early access (miễn phí)</Tag></Descriptions.Item>
        <Descriptions.Item label="Dung lượng két">Không giới hạn số hạng mục · tệp đính kèm tối đa 2 MB/tệp</Descriptions.Item>
        <Descriptions.Item label="Người được uỷ quyền">Không giới hạn</Descriptions.Item>
      </Descriptions>
      <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>Gói gia đình và kênh đối tác (bảo hiểm, ngân hàng, công chứng) — Phase 3.</Typography.Paragraph>
    </Card>
  );
}
