/**
 * Kết nối / ngắt ví. Ví theo chuẩn Wallet Standard (Phantom, Solflare…) tự xuất hiện; localnet có thêm ví thử.
 * Ngoài mainnet có nút xin SOL thử (airdrop) để trả phí trên localnet/devnet.
 */
import { App, Button, Dropdown, Space, Tag, Typography } from 'antd';
import { GiftOutlined, WalletOutlined } from '@ant-design/icons';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useMutation, useQuery } from '@tanstack/react-query';
import { config } from '../config';
import { errorText, short, sol } from '../lib/format';

function Balance() {
  const { message } = App.useApp();
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const balance = useQuery({
    queryKey: ['balance', publicKey?.toBase58()],
    queryFn: () => connection.getBalance(publicKey!),
    enabled: !!publicKey,
    refetchInterval: 4_000,
  });
  const airdrop = useMutation({
    mutationFn: async () => {
      const sig = await connection.requestAirdrop(publicKey!, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, 'confirmed');
    },
    onSuccess: () => { void balance.refetch(); message.success('Đã nhận 1 SOL thử.'); },
    onError: (e) => message.error(errorText(e)),
  });
  return (
    <Space size={4}>
      <Typography.Text type="secondary">{balance.data == null ? '…' : sol(balance.data)}</Typography.Text>
      {config.cluster !== 'mainnet' && (
        <Button size="small" icon={<GiftOutlined />} loading={airdrop.isPending} onClick={() => airdrop.mutate()}>Xin SOL thử</Button>
      )}
    </Space>
  );
}

export function WalletBar() {
  const { wallets, wallet, publicKey, select, disconnect, connecting } = useWallet();
  const installed = wallets.filter((w) => w.readyState === 'Installed' || w.readyState === 'Loadable');

  if (publicKey)
    return (
      <Space wrap>
        <Balance />
        <Tag color="green" icon={<WalletOutlined />} title={publicKey.toBase58()} data-address={publicKey.toBase58()}>{wallet?.adapter.name} · {short(publicKey)}</Tag>
        <Typography.Text copyable={{ text: publicKey.toBase58(), tooltips: ['Chép địa chỉ ví', 'Đã chép'] }} />
        <Button size="small" onClick={() => void disconnect()}>Ngắt ví</Button>
      </Space>
    );

  return (
    <Dropdown
      trigger={['click']}
      menu={{
        items: installed.length
          ? installed.map((w) => ({ key: w.adapter.name, label: w.adapter.name, icon: <img src={w.adapter.icon} alt="" width={16} /> }))
          : [{ key: 'none', label: 'Chưa cài ví Solana (vd. Phantom)', disabled: true }],
        // WalletProvider bật autoConnect: chọn ví là tự kết nối.
        onClick: ({ key }) => select(key as never),
      }}
    >
      <Button type="primary" icon={<WalletOutlined />} loading={connecting}>
        Kết nối ví {config.cluster !== 'mainnet' && <Tag style={{ marginInlineStart: 6 }}>{config.cluster}</Tag>}
      </Button>
    </Dropdown>
  );
}
