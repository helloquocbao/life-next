import { Alert, Layout, Tabs, Typography } from 'antd';
import { Brand } from '@deathnote/ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { config } from './config';
import { WalletBar } from './components/WalletBar';
import { OwnerPage } from './pages/OwnerPage';
import { HeirPage } from './pages/HeirPage';

export function App() {
  const { publicKey } = useWallet();
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Header className="chain-header">
        <Brand name="LifeNext" subtitle="On Solana" size={18} />
        <WalletBar />
      </Layout.Header>
      {config.demoTime && (
        <Alert banner type="info" title="Bản trình diễn: thời gian được nén — 1 ngày ≈ 4 giây (1 tháng ≈ 2 phút)." />
      )}
      <Layout.Content className="chain-content">
        {!publicKey ? (
          <div className="chain-intro">
            <Typography.Title level={2}>Két số tự bàn giao</Typography.Title>
            <Typography.Paragraph>
              Cất thông tin và tài liệu cho người thân. Mỗi tháng bạn thanh toán là một lần xác nhận bạn vẫn ổn;
              ngừng quá 30 ngày, người bạn chọn sẽ nhận được két. Không ai khác — kể cả chúng tôi — đọc được nội dung.
            </Typography.Paragraph>
            <Typography.Paragraph type="secondary">Kết nối ví Solana để bắt đầu. Mất ví là mất két — không ai khôi phục được.</Typography.Paragraph>
            <WalletBar />
          </div>
        ) : (
          <Tabs items={[
            { key: 'owner', label: 'Két của tôi', children: <OwnerPage /> },
            { key: 'heir', label: 'Được giao cho tôi', children: <HeirPage /> },
          ]} />
        )}
      </Layout.Content>
    </Layout>
  );
}
