import { useEffect, useState } from 'react';
import { App, Alert, Button, Card, Flex, List, Radio, Space, Typography } from 'antd';
import { CheckCircleTwoTone } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { buildDistribution, type Allocation } from '@deathnote/crypto';
import { TrusteeRole, TrusteeStatus, unwrap, type TrusteeDto } from '@deathnote/api';
import { ErrorAlert, trusteeRoleLabel } from '@deathnote/ui';
import { api } from '../config';
import { useOwnerStatus, useVault } from '../lib/api-hooks';
import { useAllocation } from '../lib/useAllocation';
import { useDecryptedItems } from '../lib/useDecryptedItems';
import { useVaultSession } from '../session/vaultSession';
import { AllocationEditor } from './AllocationEditor';

/**
 * "Cần bao nhiêu người đồng ý" + "Ai nhận gì" — phần phân mảnh khoá (Shamir) cho từng người thân.
 * Chỉ hiện khi RELEASE_FLOW_ENABLED (xem RecipientsPage.tsx).
 */
export function DistributionSection({ trustees }: { trustees: TrusteeDto[] }) {
  const vaultKey = useVaultSession((s) => s.vaultKey);
  const vault = useVault();
  const status = useOwnerStatus();
  const allocationQuery = useAllocation();
  const { items } = useDecryptedItems();
  const qc = useQueryClient();
  const { message, modal } = App.useApp();

  // Chỉ người đã xác nhận VÀ đã tạo khoá cá nhân mới có thể nhận phần được phân.
  const ready = trustees.filter((t) => t.status === TrusteeStatus.Confirmed && !!t.publicKey);
  const keyHolders = ready.filter((t) => t.role === TrusteeRole.KeyHolder);
  const pending = trustees.filter((t) => !ready.includes(t));
  const n = keyHolders.length;
  const minM = n >= 2 ? 2 : 1;

  const [threshold, setThreshold] = useState(2);
  const [allocation, setAllocation] = useState<Allocation>({ v: 1, assignments: {}, letters: {} });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [editing, setEditing] = useState<TrusteeDto>();

  useEffect(() => {
    if (allocationQuery.data && !dirty) setAllocation(allocationQuery.data);
  }, [allocationQuery.data, dirty]);
  useEffect(() => {
    const current = vault.data?.threshold ?? Math.min(2, Math.max(1, n));
    setThreshold(Math.min(Math.max(current, minM), Math.max(n, 1)));
  }, [vault.data?.threshold, n, minM]);

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
        threshold,
        recipients: ready.map((t) => ({ id: t.id!, publicKey: t.publicKey!, isKeyHolder: t.role === TrusteeRole.KeyHolder })),
        items: items.map((i) => ({ id: i.id, itemKey: i.itemKey, title: i.data.title, kind: i.data.kind })),
        allocation,
      });
      await unwrap(api.POST('/api/app/vault/distribute-keys', { body: payload }));
      setDirty(false);
      await qc.invalidateQueries();
      message.success('Đã lưu — thông tin dành cho người thân đã được cập nhật.');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const confirm = () =>
    modal.confirm({
      title: 'Lưu lại lựa chọn của bạn?',
      content: 'Chúng tôi sẽ khoá lại thông tin cho từng người thân theo đúng lựa chọn hiện tại của bạn. Việc này diễn ra ngay trên thiết bị của bạn.',
      okText: 'Lưu',
      cancelText: 'Để sau',
      onOk: distribute,
    });

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {(vault.data?.keysOutdated || dirty) && (
        <Alert type="warning" showIcon
          title={dirty ? 'Bạn có thay đổi chưa lưu.' : 'Danh sách người thân vừa thay đổi.'}
          description='Bấm "Lưu lựa chọn" ở cuối trang để cập nhật cho đúng.' />
      )}
      {pending.length > 0 && (
        <Alert type="info" showIcon title={`${pending.length} người chưa hoàn tất lời mời — họ chưa thể nhận phần được chọn.`} />
      )}

      {/* -------- Cần bao nhiêu người đồng ý — chọn bằng nút bấm, không kéo thanh -------- */}
      <Card title="Cần bao nhiêu người đồng ý để mở thông tin?">
        {n === 0 ? (
          <Typography.Text type="secondary">Cần ít nhất một người ở vai trò "Người cùng quyết định mở" đã hoàn tất lời mời.</Typography.Text>
        ) : (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Typography.Paragraph style={{ margin: 0 }}>
              Bạn có <b>{n}</b> người ở vai trò quyết định. Chọn số người cần đồng ý trước khi thông tin được mở:
            </Typography.Paragraph>
            <Radio.Group value={threshold} onChange={(e) => { setThreshold(e.target.value); setDirty(true); }}
              optionType="button" buttonStyle="solid" size="large" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Array.from({ length: n - minM + 1 }, (_, i) => i + minM).map((v) => (
                <Radio key={v} value={v} style={{ flex: '1 0 auto' }}>{v === n ? `Tất cả ${n} người` : `${v} trong ${n} người`}</Radio>
              ))}
            </Radio.Group>
            {n === 1 && <Alert type="warning" showIcon title="Nên mời thêm ít nhất 1–2 người nữa để không một mình ai quyết định được." />}
            {n > 2 && threshold === n && <Alert type="warning" showIcon title="Nếu một người sau này không liên lạc được, thông tin sẽ không mở được. Cân nhắc chọn số nhỏ hơn." />}
          </Space>
        )}
      </Card>

      {/* -------- Ai nhận gì — làm việc với từng người một, không phải bảng lớn -------- */}
      <Card title="Chọn thông tin cho từng người">
        {ready.length === 0 ? (
          <Typography.Text type="secondary">Chưa có người thân nào sẵn sàng để nhận thông tin.</Typography.Text>
        ) : (
          <List dataSource={ready} renderItem={(t) => {
            const count = (allocation.assignments[t.id!] ?? []).length;
            const hasLetter = !!allocation.letters[t.id!]?.trim();
            return (
              <List.Item style={{ padding: '12px 0' }}
                actions={[<Button key="edit" onClick={() => setEditing(t)}>{count > 0 || hasLetter ? 'Sửa lựa chọn' : 'Chọn thông tin'}</Button>]}>
                <List.Item.Meta title={<span>{t.displayName} <span className="muted" style={{ fontWeight: 400 }}>· {trusteeRoleLabel[t.role ?? 0]}</span></span>}
                  description={
                    count === 0 && !hasLetter ? 'Chưa chọn gì cho người này' :
                      <>{count > 0 && `${count} mục thông tin`}{count > 0 && hasLetter && ' · '}{hasLetter && <>Có thư riêng <CheckCircleTwoTone twoToneColor="#2f6f5e" /></>}</>
                  } />
              </List.Item>
            );
          }} />
        )}
      </Card>

      <ErrorAlert error={error} />
      <Flex justify="end">
        <Button type="primary" size="large" loading={busy} onClick={confirm}>Lưu lựa chọn</Button>
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
