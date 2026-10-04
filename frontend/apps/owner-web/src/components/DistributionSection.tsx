import { useEffect, useState } from 'react';
import { App, Alert, Button, Card, Flex, List, Space, Typography } from 'antd';
import { CheckCircleTwoTone } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { buildDistribution, type Allocation } from '@deathnote/crypto';
import { TrusteeRole, TrusteeStatus, unwrap, type TrusteeDto } from '@deathnote/api';
import { ErrorAlert, colors } from '@deathnote/ui';
import { api } from '../config';
import { useOwnerStatus, useVault } from '../lib/api-hooks';
import { useAllocation } from '../lib/useAllocation';
import { useDecryptedItems } from '../lib/useDecryptedItems';
import { useVaultSession } from '../session/vaultSession';
import { AllocationEditor } from './AllocationEditor';

/**
 * "Ai nhận gì" — chọn thông tin cho từng NGƯỜI NHẬN THÔNG TIN. Phần dành cho mỗi người được niêm phong ngay trên
 * thiết bị của bạn bằng khoá công khai của họ; hết thời gian ân hạn mà bạn không bấm "Tôi vẫn ổn" thì hệ thống
 * tự động trao cho họ. Người nhắc nhở không nhận thông tin nào nên không xuất hiện ở đây.
 */
export function DistributionSection({ trustees }: { trustees: TrusteeDto[] }) {
  const vaultKey = useVaultSession((s) => s.vaultKey);
  const vault = useVault();
  const status = useOwnerStatus();
  const allocationQuery = useAllocation();
  const { items } = useDecryptedItems();
  const qc = useQueryClient();
  const { message, modal } = App.useApp();

  // Chỉ người nhận đã xác nhận VÀ đã tạo khoá cá nhân mới có thể nhận phần được niêm phong.
  const recipients = trustees.filter((t) => t.role === TrusteeRole.Recipient);
  const ready = recipients.filter((t) => t.status === TrusteeStatus.Confirmed && !!t.publicKey);
  const notReady = recipients.filter((t) => !ready.includes(t));

  const [allocation, setAllocation] = useState<Allocation>({ v: 1, assignments: {}, letters: {} });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [editing, setEditing] = useState<TrusteeDto>();

  useEffect(() => {
    if (allocationQuery.data && !dirty) setAllocation(allocationQuery.data);
  }, [allocationQuery.data, dirty]);

  const toggle = (tid: string, itemId: string, on: boolean) => {
    setDirty(true);
    setAllocation((a) => {
      const set = new Set(a.assignments[tid] ?? []);
      if (on) set.add(itemId); else set.delete(itemId);
      return { ...a, assignments: { ...a.assignments, [tid]: [...set] } };
    });
  };
  const setLetter = (tid: string, text: string) => {
    setDirty(true);
    setAllocation((a) => ({ ...a, letters: { ...a.letters, [tid]: text } }));
  };

  const distribute = async () => {
    if (!vaultKey) return;
    setBusy(true);
    setError(undefined);
    try {
      // Toàn bộ phần mật mã chạy ở đây, trên trình duyệt của owner.
      const payload = await buildDistribution({
        vaultKey,
        ownerName: status.data?.displayName ?? '',
        recipients: ready.map((t) => ({ id: t.id!, publicKey: t.publicKey! })),
        items: items.map((i) => ({ id: i.id, itemKey: i.itemKey, title: i.data.title, kind: i.data.kind })),
        allocation,
      });
      await unwrap(api.POST('/api/app/vault/distribute-keys', { body: payload }));
      setDirty(false);
      await qc.invalidateQueries();
      message.success('Đã lưu — phần dành cho từng người nhận đã được cập nhật.');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const confirm = () =>
    modal.confirm({
      title: 'Lưu lại lựa chọn của bạn?',
      content: 'Chúng tôi sẽ khoá lại thông tin cho từng người nhận theo đúng lựa chọn hiện tại. Việc này diễn ra ngay trên thiết bị của bạn.',
      okText: 'Lưu',
      cancelText: 'Để sau',
      onOk: distribute,
    });

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {(vault.data?.keysOutdated || dirty) && (
        <Alert type="warning" showIcon
          title={dirty ? 'Bạn có thay đổi chưa lưu.' : 'Danh sách người nhận vừa thay đổi.'}
          description='Bấm "Lưu lựa chọn" ở cuối trang để cập nhật cho đúng.' />
      )}
      {notReady.length > 0 && (
        <Alert type="warning" showIcon
          title={`${notReady.length} người nhận chưa hoàn tất lời mời — họ sẽ KHÔNG nhận được thông tin.`}
          description={`Hãy bấm "Gửi lời mời ngay" cho ${notReady.map((t) => t.displayName).join(', ')} để họ tạo khoá cá nhân. Thiếu bước này, phần dành cho họ không thể được niêm phong.`} />
      )}

      <Card title="Chọn thông tin cho từng người nhận">
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          Nếu bạn không bấm "Tôi vẫn ổn" sau thời gian ân hạn{status.data?.graceDays ? ` (${status.data.graceDays} ngày)` : ''}, hệ thống tự động gửi cho mỗi người đúng phần bạn chọn ở đây.
        </Typography.Paragraph>
        {ready.length === 0 ? (
          <Typography.Text type="secondary">Chưa có người nhận nào sẵn sàng. Thêm một "Người nhận thông tin" rồi gửi lời mời để họ tạo khoá.</Typography.Text>
        ) : (
          <List dataSource={ready} renderItem={(t) => {
            const count = (allocation.assignments[t.id!] ?? []).length;
            const hasLetter = !!allocation.letters[t.id!]?.trim();
            return (
              <List.Item style={{ padding: '12px 0' }}
                actions={[<Button key="edit" onClick={() => setEditing(t)}>{count > 0 || hasLetter ? 'Sửa lựa chọn' : 'Chọn thông tin'}</Button>]}>
                <List.Item.Meta title={t.displayName}
                  description={
                    count === 0 && !hasLetter ? 'Chưa chọn gì cho người này' :
                      <>{count > 0 && `${count} mục thông tin`}{count > 0 && hasLetter && ' · '}{hasLetter && <>Có thư riêng <CheckCircleTwoTone twoToneColor={colors.primary} /></>}</>
                  } />
              </List.Item>
            );
          }} />
        )}
      </Card>

      <ErrorAlert error={error} />
      <Flex justify="end">
        <Button type="primary" size="large" loading={busy} disabled={ready.length === 0} onClick={confirm}>Lưu lựa chọn</Button>
      </Flex>

      {editing && (
        <AllocationEditor trustee={editing} items={items} selectedIds={allocation.assignments[editing.id!] ?? []}
          letter={allocation.letters[editing.id!] ?? ''}
          onToggle={(itemId, on) => toggle(editing.id!, itemId, on)}
          onLetterChange={(text) => setLetter(editing.id!, text)}
          onClose={() => setEditing(undefined)} />
      )}
    </Space>
  );
}
