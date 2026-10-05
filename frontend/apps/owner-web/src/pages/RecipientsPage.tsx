/**
 * NGƯỜI THÂN — hai vai trò, theo đúng trình tự xảy ra khi bạn ngừng bấm "Tôi vẫn ổn":
 *   1) Người nhắc nhở: được báo trước, nhiệm vụ nhắc bạn bấm nút.
 *   2) Người nhận thông tin: hết thời gian ân hạn mà bạn vẫn không bấm thì tự động nhận phần bạn cho phép.
 * Danh sách hiển thị dạng thẻ (không phải bảng dày đặc); phần "chọn thông tin cho từng người" nằm ở
 * components/DistributionSection.tsx.
 */
import { useState } from 'react';
import { App, Button, Card, Modal, Popconfirm, Space, Steps, Tag, Typography } from 'antd';
import { BellOutlined, EditOutlined, FolderOpenOutlined, GiftOutlined, KeyOutlined, MailOutlined, PlusOutlined } from '@ant-design/icons';
import { TrusteeRole, TrusteeStatus, unwrap, type TrusteeDto } from '@deathnote/api';
import {
  EmptyCard, ErrorAlert, PageHeader, SplitRow, StatusTag, colors,
  contactResponseLabel, formatRelative, trusteeRoleHint, trusteeRoleLabel, trusteeStatusColor, trusteeStatusLabel,
} from '@deathnote/ui';
import { api } from '../config';
import { DistributionSection } from '../components/DistributionSection';
import { TrusteeFormModal } from '../components/TrusteeFormModal';
import { UnlockGate } from '../components/UnlockGate';
import { useInvalidateOwner, useOwnerStatus, useTrustees } from '../lib/api-hooks';

type ModalState = { open: boolean; trustee?: TrusteeDto; role?: TrusteeRole };

const SECTIONS = [
  { role: TrusteeRole.Reminder, icon: <BellOutlined />, title: 'Người nhắc nhở', addLabel: 'Thêm người nhắc nhở', empty: 'Chưa có người nhắc nhở — sẽ không ai được báo khi bạn im lặng.' },
  { role: TrusteeRole.Recipient, icon: <GiftOutlined />, title: 'Người nhận thông tin', addLabel: 'Thêm người nhận', empty: 'Chưa có người nhận — chưa ai nhận được thông tin của bạn.' },
] as const;

export function RecipientsPage() {
  const trustees = useTrustees();
  const status = useOwnerStatus();
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [pickerOpen, setPickerOpen] = useState(false);
  const invalidate = useInvalidateOwner();
  const { message } = App.useApp();
  const graceDays = status.data?.graceDays;

  const remove = async (t: TrusteeDto) => {
    await unwrap(api.DELETE('/api/app/trustee/{id}', { params: { path: { id: t.id! } } }));
    await invalidate();
    message.success('Đã xoá.');
  };
  const resend = async (t: TrusteeDto) => {
    await unwrap(api.POST('/api/app/trustee/{id}/resend-invitation', { params: { path: { id: t.id! } } }));
    message.success(t.status === TrusteeStatus.NotInvitedYet ? 'Đã gửi lời mời.' : 'Đã gửi lại lời mời.');
  };

  const list = trustees.data ?? [];

  return (
    <div className="page">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <PageHeader title="Người thân" subtitle="Ai được báo khi bạn im lặng, và ai sẽ nhận thông tin của bạn." />

        {/* Trình tự — người dùng luôn thấy "chuyện gì xảy ra, theo thứ tự nào" */}
        <Card styles={{ body: { padding: '20px 24px' } }}>
          <Steps size="small" responsive current={-1} items={[
            { title: 'Bạn ngừng bấm', description: 'Hệ thống nhắc bạn qua nhiều kênh' },
            { title: 'Báo người nhắc nhở', description: graceDays ? `Họ có ${graceDays} ngày để liên lạc và nhắc bạn` : 'Họ liên lạc và nhắc bạn bấm nút' },
            { title: 'Tự động gửi', description: 'Người nhận thông tin nhận phần bạn đã chọn' },
          ]} />
          <Typography.Paragraph type="secondary" style={{ margin: '14px 0 0', fontSize: 13 }}>
            Bạn bấm "Tôi vẫn ổn" ở bất kỳ lúc nào trước bước cuối là mọi thứ dừng lại ngay.
          </Typography.Paragraph>
        </Card>

        {trustees.error && <ErrorAlert error={trustees.error} />}

        {SECTIONS.map((sec) => {
          const members = list.filter((t) => t.role === sec.role);
          return (
            <section key={sec.role}>
              <SplitRow align="center" gap={12}
                left={
                  <div>
                    <Typography.Title level={4} style={{ margin: 0 }}><span style={{ color: colors.primary }}>{sec.icon}</span> {sec.title}</Typography.Title>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>{trusteeRoleHint[sec.role]}</Typography.Text>
                  </div>
                }
                right={<Button type="primary" icon={<PlusOutlined />} onClick={() => setModal({ open: true, role: sec.role })}>{sec.addLabel}</Button>} />
              <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 12 }}>
                {!trustees.isLoading && members.length === 0 && <EmptyCard description={sec.empty} />}
                {members.map((t) => <TrusteeCard key={t.id} t={t} onPick={() => setPickerOpen(true)} onEdit={() => setModal({ open: true, trustee: t })} onResend={() => resend(t)} onRemove={() => remove(t)} />)}
              </Space>
            </section>
          );
        })}

      </Space>
      {/* Màn này chỉ QUẢN TRỊ người thân — không bắt mở khoá két. Chỉ khi bấm "Chọn thông tin" (cần đọc hạng mục trong két
          để mã hoá phần cho từng người) mới hỏi mở khoá, ngay trong hộp thoại. */}
      <Modal open={pickerOpen} onCancel={() => setPickerOpen(false)} footer={null} width={760} destroyOnHidden title="Chọn thông tin cho từng người nhận">
        <UnlockGate reason="Mở khoá để chọn thông tin cho từng người nhận.">
          <DistributionSection trustees={list} />
        </UnlockGate>
      </Modal>
      <TrusteeFormModal open={modal.open} trustee={modal.trustee} defaultRole={modal.role} onClose={() => setModal({ open: false })} />
    </div>
  );
}

function TrusteeCard({ t, onPick, onEdit, onResend, onRemove }: { t: TrusteeDto; onPick: () => void; onEdit: () => void; onResend: () => void; onRemove: () => void }) {
  const isRecipient = t.role === TrusteeRole.Recipient;
  const notInvited = t.status === TrusteeStatus.NotInvitedYet;
  return (
    <Card>
      <SplitRow
        left={
          <>
            <Typography.Text strong style={{ fontSize: 17 }}>{t.displayName}</Typography.Text>
            <div className="muted">{t.relationship ?? 'Người thân'} · {t.email}</div>
            <Space wrap style={{ marginTop: 8 }}>
              <Tag>{trusteeRoleLabel[t.role ?? TrusteeRole.Reminder]}</Tag>
              {!isRecipient && <StatusTag value={t.status ?? 0} label={trusteeStatusLabel} color={trusteeStatusColor} />}
              {isRecipient && t.hasCurrentGrant && <Tag icon={<KeyOutlined />} color="green">Đã chuẩn bị {t.grantItemCount ?? 0} mục cho họ</Tag>}
            </Space>

            {isRecipient && !t.hasCurrentGrant && (
              <div style={{ fontSize: 13, marginTop: 6, color: colors.amber }}>Chưa chọn thông tin cho người này.</div>
            )}
            {isRecipient && t.hasCurrentGrant && (
              <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                Họ chưa biết gì. Họ chỉ nhận email khi bạn gặp sự cố (không bấm "Tôi vẫn ổn" sau thời gian ân hạn).
              </div>
            )}
            {!isRecipient && notInvited && (
              <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                Họ chưa biết gì. Hệ thống tự mời khi bạn bỏ lỡ xác nhận "vẫn ổn" — hoặc bạn có thể mời ngay.
              </div>
            )}
            {!isRecipient && t.lastContactResponse != null && (
              <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{contactResponseLabel[t.lastContactResponse]} · {formatRelative(t.lastContactResponseAt)}</div>
            )}
          </>
        }
        right={
          <>
            {!isRecipient && t.status !== TrusteeStatus.Confirmed && (
              <Button icon={<MailOutlined />} onClick={onResend}>
                {notInvited ? 'Gửi lời mời ngay' : 'Gửi lại lời mời'}
              </Button>
            )}
            {isRecipient && <Button type={t.hasCurrentGrant ? 'default' : 'primary'} icon={<FolderOpenOutlined />} onClick={onPick}>Chọn thông tin</Button>}
            <Button icon={<EditOutlined />} onClick={onEdit}>Sửa</Button>
            <Popconfirm title="Xoá người này?" description={isRecipient ? 'Phần bạn đã chọn cho họ cũng sẽ bị xoá.' : undefined} onConfirm={onRemove} okText="Xoá" cancelText="Không">
              <Button danger>Xoá</Button>
            </Popconfirm>
          </>
        } />
    </Card>
  );
}
