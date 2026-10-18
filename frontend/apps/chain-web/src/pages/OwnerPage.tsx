/** A: thanh toán/check-in, danh sách két (giải mã sau khi ký mở khoá), tạo/sửa/xoá két, xoá tài khoản. */
import { useState } from 'react';
import { Alert, App, Button, Card, Empty, List, Modal, Popconfirm, Skeleton, Space, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, LockOutlined, PlusOutlined } from '@ant-design/icons';
import type { VaultAccount } from '@deathnote/chain';
import { OwnerStatusCard } from '../components/OwnerStatusCard';
import { VaultEditor } from '../components/VaultEditor';
import { VaultContentView } from '../components/VaultContentView';
import { useCloseProfile, useDeleteVault, useMyProfile, useMyVaults, useOwnVaultContent } from '../lib/hooks';
import { useSession } from '../lib/session';
import { errorText, short } from '../lib/format';

function VaultRow({ vault, onEdit, onView }: { vault: VaultAccount; onEdit: (v: VaultAccount) => void; onView: (v: VaultAccount) => void }) {
  const { message } = App.useApp();
  const content = useOwnVaultContent(vault);
  const del = useDeleteVault();
  return (
    <List.Item
      actions={vault.claimed ? [] : [
        <Button key="v" size="small" icon={<EyeOutlined />} disabled={!content.data} onClick={() => onView(vault)}>Xem</Button>,
        <Button key="e" size="small" icon={<EditOutlined />} disabled={!content.data} onClick={() => onEdit(vault)}>Sửa</Button>,
        <Popconfirm key="d" title="Xoá két này?" description="Người nhận sẽ không bao giờ mở được." okText="Xoá" cancelText="Huỷ"
          okButtonProps={{ danger: true }}
          onConfirm={() => del.mutateAsync(vault).then(() => message.success('Đã xoá két.'), (e) => message.error(errorText(e)))}>
          <Button size="small" danger icon={<DeleteOutlined />} loading={del.isPending}>Xoá</Button>
        </Popconfirm>,
      ]}>
      <List.Item.Meta
        title={content.isLoading ? <Skeleton.Input size="small" active /> : content.data?.content.title ?? (content.error ? 'Không giải mã được' : `Két #${vault.id}`)}
        description={<Space size={4} wrap>
          <span>Người nhận: <Typography.Text code>{short(vault.heir)}</Typography.Text></span>
          {vault.claimed && <Tag color="red">Người nhận đã lấy</Tag>}
          {content.data && <Tag>{content.data.content.entries.length} mục · {content.data.content.files.length} tệp</Tag>}
        </Space>} />
    </List.Item>
  );
}

export function OwnerPage() {
  const { message } = App.useApp();
  const { masterKey, unlock } = useSession();
  const vaults = useMyVaults();
  const profile = useMyProfile();
  const closeProfile = useCloseProfile();
  const [editing, setEditing] = useState<VaultAccount | null | undefined>();
  const [viewing, setViewing] = useState<VaultAccount | null>(null);
  const editingContent = useOwnVaultContent(editing ?? null);
  const viewingContent = useOwnVaultContent(viewing);
  const [unlocking, setUnlocking] = useState(false);

  const doUnlock = async () => {
    setUnlocking(true);
    try { await unlock(); } catch (e) { message.error(errorText(e)); } finally { setUnlocking(false); }
  };

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <OwnerStatusCard />
      <Card title="Két của tôi"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => masterKey ? setEditing(null) : void doUnlock().then(() => setEditing(null))}>Tạo két</Button>}>
        {!masterKey && (vaults.data?.length ?? 0) > 0 && (
          <Alert type="info" showIcon style={{ marginBottom: 12 }} title="Két đang khoá"
            description="Ký bằng ví để mở khoá và xem tên các két. Chữ ký không tốn phí và chỉ dùng trên trang này."
            action={<Button icon={<LockOutlined />} loading={unlocking} onClick={() => void doUnlock()}>Mở khoá</Button>} />
        )}
        {vaults.isLoading ? <Skeleton active /> : (vaults.data?.length ?? 0) === 0 ? (
          <Empty description="Chưa có két nào" />
        ) : (
          <List dataSource={vaults.data} renderItem={(v) => <VaultRow vault={v} onEdit={setEditing} onView={setViewing} />} />
        )}
      </Card>

      {profile.data && profile.data.vaultCount === 0 && (
        <Card size="small">
          <Space>
            <Typography.Text type="secondary">Không dùng nữa? Xoá tài khoản để hoàn tiền cọc lưu trữ trên chuỗi.</Typography.Text>
            <Popconfirm title="Xoá tài khoản?" okText="Xoá" cancelText="Huỷ" okButtonProps={{ danger: true }}
              onConfirm={() => closeProfile.mutateAsync().then(() => message.success('Đã xoá tài khoản.'), (e) => message.error(errorText(e)))}>
              <Button danger size="small" loading={closeProfile.isPending}>Xoá tài khoản</Button>
            </Popconfirm>
          </Space>
        </Card>
      )}

      {editing === null && <VaultEditor onClose={() => setEditing(undefined)} />}
      {editing && editingContent.data && (
        <VaultEditor existing={{ vault: editing, vaultKey: editingContent.data.vaultKey, content: editingContent.data.content }}
          onClose={() => setEditing(undefined)} />
      )}
      <Modal open={!!viewing} title={viewingContent.data?.content.title} footer={null} onCancel={() => setViewing(null)} width={640}>
        {viewingContent.data && <VaultContentView content={viewingContent.data.content} />}
      </Modal>
    </Space>
  );
}
