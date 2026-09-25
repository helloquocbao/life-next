/**
 * NGƯỜI NHẬN — thiết kế cho người KHÔNG rành công nghệ, từng bước một thay vì một bảng lớn.
 *  - Danh sách người thân: hiển thị dạng thẻ (card), không phải bảng dày đặc.
 *  - "Cần bao nhiêu người đồng ý": chọn bằng nút bấm sẵn, không kéo thanh trượt.
 *  - "Ai nhận gì": làm việc với TỪNG người một lúc (mở hộp thoại riêng), không phải ma trận
 *    hạng mục × người nhận trên một bảng — dễ rối với người không quen bảng tính.
 *  - Kỹ thuật: khi lưu, khoá phát hành được chia (Shamir) và mỗi phần được khoá hai lớp
 *    NGAY TRÊN TRÌNH DUYỆT rồi mới gửi server — nhưng từ "phân mảnh khoá" không hiện ra UI.
 */
import { useEffect, useMemo, useState } from 'react';
import { App, Alert, Button, Card, Checkbox, Drawer, Empty, Flex, Input, List, Popconfirm, Radio, Space, Tag, Typography } from 'antd';
import { CheckCircleTwoTone, EditOutlined, KeyOutlined, MailOutlined, PlusOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { buildDistribution, type Allocation } from '@deathnote/crypto';
import { TrusteeRole, TrusteeStatus, unwrap, type TrusteeDto } from '@deathnote/api';
import { ErrorAlert, contactResponseLabel, formatRelative, trusteeRoleLabel, trusteeStatusColor, trusteeStatusLabel } from '@deathnote/ui';
import { api } from '../config';
import { TrusteeFormModal } from '../components/TrusteeFormModal';
import { UnlockGate } from '../components/UnlockGate';
import { useOwnerStatus, useTrustees, useVault, useInvalidateOwner } from '../lib/api-hooks';
import { useAllocation } from '../lib/useAllocation';
import { useDecryptedItems, type DecryptedItem } from '../lib/useDecryptedItems';
import { kindDef } from '../lib/itemKinds';
import { useVaultSession } from '../session/vaultSession';

export function RecipientsPage() {
  const trustees = useTrustees();
  const [modal, setModal] = useState<{ open: boolean; trustee?: TrusteeDto }>({ open: false });
  const invalidate = useInvalidateOwner();
  const { message } = App.useApp();

  const remove = async (t: TrusteeDto) => {
    await unwrap(api.DELETE('/api/app/trustee/{id}', { params: { path: { id: t.id! } } }));
    await invalidate();
    message.success('Đã xoá. Đừng quên bấm "Lưu" bên dưới để cập nhật.');
  };
  const resend = async (t: TrusteeDto) => {
    await unwrap(api.POST('/api/app/trustee/{id}/resend-invitation', { params: { path: { id: t.id! } } }));
    message.success('Đã gửi lại lời mời.');
  };

  return (
    <div className="page">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Flex justify="space-between" align="end" wrap gap={12}>
          <div>
            <Typography.Title level={2} style={{ margin: 0 }}>Người nhận</Typography.Title>
            <Typography.Text type="secondary">Ai sẽ nhận thông tin của bạn, và khi nào.</Typography.Text>
          </div>
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setModal({ open: true })}>Mời người thân</Button>
        </Flex>

        {trustees.error && <ErrorAlert error={trustees.error} />}
        {!trustees.isLoading && (trustees.data?.length ?? 0) === 0 && (
          <Card><Empty description="Chưa có người thân nào được mời" /></Card>
        )}
        <List loading={trustees.isLoading} dataSource={trustees.data ?? []}
          renderItem={(t) => (
            <List.Item style={{ padding: 0, marginBottom: 12, display: 'block' }}>
              <Card>
                <Flex justify="space-between" align="start" wrap gap={12}>
                  <div>
                    <Typography.Text strong style={{ fontSize: 17 }}>{t.displayName}</Typography.Text>
                    <div className="muted">{t.relationship ?? 'Người thân'} · {t.email}</div>
                    <Space wrap style={{ marginTop: 8 }}>
                      <Tag>{trusteeRoleLabel[t.role ?? 0]}</Tag>
                      <Tag color={trusteeStatusColor[t.status ?? 0]}>{trusteeStatusLabel[t.status ?? 0]}</Tag>
                      {t.hasCurrentKeyShare && <Tag icon={<KeyOutlined />} color="green">Đã sẵn sàng</Tag>}
                    </Space>
                    {t.status === TrusteeStatus.Confirmed && !t.publicKey && (
                      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Đang chờ họ mở lời mời lần đầu để hoàn tất.</div>
                    )}
                    {t.lastContactResponse != null && (
                      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{contactResponseLabel[t.lastContactResponse]} · {formatRelative(t.lastContactResponseAt)}</div>
                    )}
                  </div>
                  <Space>
                    {t.status !== TrusteeStatus.Confirmed && <Button icon={<MailOutlined />} onClick={() => resend(t)}>Gửi lại lời mời</Button>}
                    <Button icon={<EditOutlined />} onClick={() => setModal({ open: true, trustee: t })}>Sửa</Button>
                    <Popconfirm title="Xoá người này?" description="Phần bạn đã chọn cho họ cũng sẽ bị xoá." onConfirm={() => remove(t)} okText="Xoá" cancelText="Không">
                      <Button danger>Xoá</Button>
                    </Popconfirm>
                  </Space>
                </Flex>
              </Card>
            </List.Item>
          )} />

        <UnlockGate reason="Mở khoá để chọn thông tin cho từng người thân.">
          <DistributionSection trustees={trustees.data ?? []} />
        </UnlockGate>
      </Space>
      <TrusteeFormModal open={modal.open} trustee={modal.trustee} onClose={() => setModal({ open: false })} />
    </div>
  );
}

function DistributionSection({ trustees }: { trustees: TrusteeDto[] }) {
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

/**
 * Hộp thoại chọn thông tin cho MỘT người — thay cho ma trận hạng mục × người nhận trên một bảng.
 * Mỗi lần chỉ làm việc với một người, danh sách hạng mục hiện theo cột dọc dễ đọc, dễ chạm.
 */
function AllocationEditor({ trustee, items, selectedIds, letter, onToggle, onLetterChange, onClose }: {
  trustee: TrusteeDto;
  items: DecryptedItem[];
  selectedIds: string[];
  letter: string;
  onToggle: (itemId: string, on: boolean) => void;
  onLetterChange: (text: string) => void;
  onClose: () => void;
}) {
  const sorted = useMemo(() => [...items].sort((a, b) => a.data.kind.localeCompare(b.data.kind)), [items]);
  const selected = new Set(selectedIds);

  // Dùng Drawer thay vì Modal: nhiều chỗ hơn cho danh sách dài, dễ thao tác trên màn hình nhỏ.
  return (
    <Drawer open onClose={onClose} title={`Chọn thông tin cho ${trustee.displayName}`} size="large"
      extra={<Button type="primary" onClick={onClose}>Xong</Button>}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Typography.Text strong style={{ fontSize: 15 }}>Thông tin muốn gửi cho {trustee.displayName}</Typography.Text>
          <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Chỉ tích những mục bạn muốn người này nhận.</div>
          {sorted.length === 0 ? (
            <Typography.Text type="secondary">Bạn chưa lưu thông tin nào. Vào mục "Két thông tin" hoặc "Tài sản & quyền lợi" để thêm.</Typography.Text>
          ) : (
            <List bordered dataSource={sorted} renderItem={(it) => (
              <List.Item style={{ cursor: 'pointer' }} onClick={() => onToggle(it.id, !selected.has(it.id))}>
                <Checkbox checked={selected.has(it.id)} onChange={(e) => onToggle(it.id, e.target.checked)} style={{ width: '100%' }}>
                  <span style={{ fontSize: 16 }}>{kindDef(it.data.kind).emoji} {it.data.title}</span>
                </Checkbox>
              </List.Item>
            )} />
          )}
        </div>
        <div>
          <Typography.Text strong style={{ fontSize: 15 }}>Thư riêng (không bắt buộc)</Typography.Text>
          <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Điều đầu tiên {trustee.displayName} sẽ đọc khi thông tin được mở.</div>
          <Input.TextArea rows={6} value={letter} onChange={(e) => onLetterChange(e.target.value)}
            placeholder={`Ví dụ: "Gửi ${trustee.displayName}, mẹ để lại vài điều con cần biết…"`} />
        </div>
      </Space>
    </Drawer>
  );
}
