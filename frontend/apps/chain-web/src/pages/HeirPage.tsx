/**
 * B: các két được giao cho ví này. Chỉ thấy "có két từ ví X" — không thấy nội dung cho tới khi A quá hạn
 * 30 ngày, B nhận (trả phần A còn nợ) rồi mở.
 */
import { useState } from 'react';
import { App, Button, Card, Empty, List, Modal, Skeleton, Space, Tag, Typography } from 'antd';
import { GiftOutlined, UnlockOutlined } from '@ant-design/icons';
import type { VaultAccount, VaultContent } from '@deathnote/chain';
import { config } from '../config';
import { VaultContentView } from '../components/VaultContentView';
import { useChainNow, useClaim, useInboxVaults, useOpenAsHeir, useOwnerStatus } from '../lib/hooks';
import { errorText, formatTime, remaining, short, sol } from '../lib/format';

function InboxRow({ vault, onOpened }: { vault: VaultAccount; onOpened: (c: VaultContent) => void }) {
  const { message } = App.useApp();
  const { profile, status } = useOwnerStatus(vault.owner);
  const now = useChainNow().data ?? 0;
  const claim = useClaim();
  const open = useOpenAsHeir();
  const debt = profile && profile.debtSettledFor !== profile.paidUntil ? config.monthlyPriceLamports : 0;

  const doClaim = async () => {
    try {
      await claim.mutateAsync(vault);
      message.success('Đã nhận két.');
    } catch (e) {
      message.error(errorText(e));
    }
  };
  const doOpen = async () => {
    try {
      onOpened(await open.mutateAsync(vault));
    } catch (e) {
      message.error(errorText(e));
    }
  };

  let action;
  if (vault.claimed) action = <Button type="primary" icon={<UnlockOutlined />} loading={open.isPending} onClick={() => void doOpen()}>Mở két</Button>;
  else if (status?.phase === 'released')
    action = <Button type="primary" icon={<GiftOutlined />} loading={claim.isPending} onClick={() => void doClaim()}>
      Nhận két{debt ? ` (trả ${sol(debt)} phần còn nợ)` : ''}
    </Button>;
  else action = <Tag>Chưa tới hạn</Tag>;

  return (
    <List.Item actions={[action]}>
      <List.Item.Meta
        title={<span>Két từ ví <Typography.Text code>{short(vault.owner)}</Typography.Text></span>}
        description={
          vault.claimed ? <Tag color="green">Bạn đã nhận lúc {formatTime(vault.claimedAt)}</Tag>
            : !status ? <Skeleton.Input size="small" active />
            : status.phase === 'released' ? <Tag color="red">Đã tới hạn bàn giao</Tag>
            : <span>Mở được sau {formatTime(status.releaseAt)} ({remaining(status.releaseAt - now)}) nếu chủ két không thanh toán tiếp</span>
        } />
    </List.Item>
  );
}

export function HeirPage() {
  const inbox = useInboxVaults();
  const [opened, setOpened] = useState<VaultContent | null>(null);
  return (
    <Card title="Két được giao cho tôi">
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        Bạn chỉ thấy có két được giao — nội dung luôn được mã hoá cho tới khi chủ két quá hạn thanh toán 30 ngày.
      </Typography.Paragraph>
      {inbox.isLoading ? <Skeleton active /> : (inbox.data?.length ?? 0) === 0 ? (
        <Empty description="Chưa có két nào được giao cho ví này" />
      ) : (
        <List dataSource={inbox.data} renderItem={(v) => <InboxRow vault={v} onOpened={setOpened} />} />
      )}
      <Modal open={!!opened} title={opened?.title} footer={null} onCancel={() => setOpened(null)} width={640}>
        {opened && (
          <Space orientation="vertical" style={{ width: '100%' }}>
            <VaultContentView content={opened} />
          </Space>
        )}
      </Modal>
    </Card>
  );
}
