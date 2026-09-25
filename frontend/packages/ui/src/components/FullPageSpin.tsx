import { Flex, Spin } from 'antd';

export function FullPageSpin({ tip }: { tip?: string }) {
  return (
    <Flex vertical align="center" justify="center" gap={16} style={{ minHeight: '60vh' }}>
      <Spin size="large" />
      {tip && <div style={{ color: '#6b7a80' }}>{tip}</div>}
    </Flex>
  );
}
