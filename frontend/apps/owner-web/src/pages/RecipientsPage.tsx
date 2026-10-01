/**
 * NGƯỜI NHẬN — thiết kế cho người KHÔNG rành công nghệ, từng bước một thay vì một bảng lớn.
 *  - Danh sách người thân: hiển thị dạng thẻ (card), không phải bảng dày đặc.
 *  - Phần "phân mảnh khoá & chọn thông tin cho từng người" nằm ở components/DistributionSection.tsx.
 */
import { useState } from 'react';
import { App, Button, Card, List, Popconfirm, Space, Tag, Typography } from 'antd';
import { EditOutlined, KeyOutlined, MailOutlined, PlusOutlined } from '@ant-design/icons';
import { TrusteeStatus, unwrap, type TrusteeDto } from '@deathnote/api';
import {
  EmptyCard, ErrorAlert, PageHeader, SplitRow, StatusTag,
  contactResponseLabel, formatRelative, trusteeRoleLabel, trusteeStatusColor, trusteeStatusLabel,
} from '@deathnote/ui';
import { RELEASE_FLOW_ENABLED, api } from '../config';
import { DistributionSection } from '../components/DistributionSection';
import { TrusteeFormModal } from '../components/TrusteeFormModal';
import { UnlockGate } from '../components/UnlockGate';
import { useInvalidateOwner, useTrustees } from '../lib/api-hooks';

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
    message.success(t.status === TrusteeStatus.NotInvitedYet ? 'Đã gửi lời mời.' : 'Đã gửi lại lời mời.');
  };

  return (
    <div className="page">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <PageHeader title="Người nhận" subtitle="Ai sẽ nhận thông tin của bạn, và khi nào."
          action={<Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setModal({ open: true })}>Thêm người thân</Button>} />

        {trustees.error && <ErrorAlert error={trustees.error} />}
        {!trustees.isLoading && (trustees.data?.length ?? 0) === 0 && <EmptyCard description="Chưa có người thân nào" />}
        <List loading={trustees.isLoading} dataSource={trustees.data ?? []}
          renderItem={(t) => (
            <List.Item style={{ padding: 0, marginBottom: 12, display: 'block' }}>
              <Card>
                <SplitRow
                  left={
                    <>
                      <Typography.Text strong style={{ fontSize: 17 }}>{t.displayName}</Typography.Text>
                      <div className="muted">{t.relationship ?? 'Người thân'} · {t.email}</div>
                      <Space wrap style={{ marginTop: 8 }}>
                        <Tag>{trusteeRoleLabel[t.role ?? 0]}</Tag>
                        <StatusTag value={t.status ?? 0} label={trusteeStatusLabel} color={trusteeStatusColor} />
                        {t.hasCurrentKeyShare && <Tag icon={<KeyOutlined />} color="green">Đã sẵn sàng</Tag>}
                      </Space>
                      {t.status === TrusteeStatus.Confirmed && !t.publicKey && (
                        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Đang chờ họ mở lời mời lần đầu để hoàn tất.</div>
                      )}
                      {t.status === TrusteeStatus.NotInvitedYet && (
                        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                          Đã thêm nhưng CHƯA gửi lời mời — họ chưa biết gì. Hệ thống sẽ tự động gửi khi bạn bỏ lỡ xác nhận "vẫn ổn".
                        </div>
                      )}
                      {t.lastContactResponse != null && (
                        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{contactResponseLabel[t.lastContactResponse]} · {formatRelative(t.lastContactResponseAt)}</div>
                      )}
                    </>
                  }
                  right={
                    <>
                      {t.status !== TrusteeStatus.Confirmed && (
                        <Button icon={<MailOutlined />} onClick={() => resend(t)}>
                          {t.status === TrusteeStatus.NotInvitedYet ? 'Gửi lời mời ngay' : 'Gửi lại lời mời'}
                        </Button>
                      )}
                      <Button icon={<EditOutlined />} onClick={() => setModal({ open: true, trustee: t })}>Sửa</Button>
                      <Popconfirm title="Xoá người này?" description="Phần bạn đã chọn cho họ cũng sẽ bị xoá." onConfirm={() => remove(t)} okText="Xoá" cancelText="Không">
                        <Button danger>Xoá</Button>
                      </Popconfirm>
                    </>
                  } />
              </Card>
            </List.Item>
          )} />

        {RELEASE_FLOW_ENABLED && (
          <UnlockGate reason="Mở khoá để chọn thông tin cho từng người thân.">
            <DistributionSection trustees={trustees.data ?? []} />
          </UnlockGate>
        )}
      </Space>
      <TrusteeFormModal open={modal.open} trustee={modal.trustee} onClose={() => setModal({ open: false })} />
    </div>
  );
}
