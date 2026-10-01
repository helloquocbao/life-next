/**
 * MẪU EMAIL — nội dung các thư hệ thống gửi cho owner/trustee (nhắc check-in, lời mời, cảnh báo, bàn giao…).
 *
 * - Cột trái: danh sách mẫu, gắn nhãn "Đã sửa" nếu đang dùng bản tuỳ chỉnh.
 * - Cột phải: trình soạn (tiêu đề + HTML, chèn biến {{...}}) và xem trước trực tiếp với giá trị mẫu.
 * - Chỉ người có quyền DeathNote.EmailTemplates.Manage mới lưu / khôi phục / gửi thử; mọi lần lưu được ghi audit log.
 */
import { useState } from 'react';
import { Alert, App, Card, List, Skeleton, Tag, Typography } from 'antd';
import { ErrorAlert } from '@deathnote/ui';
import { useEmailDeliveryInfo, useEmailTemplates, useProfile } from '../lib/api-hooks';
import { hasPerm, Perm } from '../lib/permissions';
import { PageTitle } from '../components/PageTitle';
import { EmailTemplateEditor } from '../components/email/EmailTemplateEditor';

function DeliveryNotice() {
  const { data } = useEmailDeliveryInfo();
  if (!data) return null;
  if (data.provider === 'resend') {
    const sandbox = data.fromAddress?.includes('@resend.dev');
    return (
      <Alert type={sandbox ? 'warning' : 'success'} showIcon style={{ marginBottom: 12 }}
        title={<>Email đang gửi qua <b>Resend</b> từ <Typography.Text code>{data.fromAddress}</Typography.Text></>}
        description={sandbox
          ? 'Địa chỉ thử nghiệm của Resend chỉ gửi được tới email chủ tài khoản Resend. Hãy verify domain trên resend.com/domains rồi đặt Resend:FromAddress để gửi cho khách hàng thật.'
          : undefined} />
    );
  }
  return (
    <Alert type="info" showIcon style={{ marginBottom: 12 }}
      title={<>Email đang gửi qua <b>SMTP</b>{data.fromAddress ? <> từ <Typography.Text code>{data.fromAddress}</Typography.Text></> : null}</>}
      description="Môi trường dev dùng Mailpit (http://localhost:8026). Cấu hình Resend:ApiKey để gửi email thật qua Resend." />
  );
}

export function EmailTemplatesPage() {
  const { data: profile } = useProfile();
  const { data: templates, isLoading, error } = useEmailTemplates();
  const { modal } = App.useApp();
  const [selectedKey, setSelectedKey] = useState<string>();
  const [dirty, setDirty] = useState(false);

  const canManage = hasPerm(profile, Perm.EmailTemplatesManage);
  const selected = templates?.find((t) => t.key === selectedKey) ?? templates?.[0];

  const select = (key: string) => {
    if (key === selected?.key) return;
    if (!dirty) return setSelectedKey(key);
    modal.confirm({
      title: 'Bỏ các thay đổi chưa lưu?',
      content: 'Mẫu đang soạn có thay đổi chưa lưu. Chuyển sang mẫu khác sẽ mất các thay đổi này.',
      okText: 'Bỏ thay đổi', cancelText: 'Ở lại', okButtonProps: { danger: true },
      onOk: () => { setDirty(false); setSelectedKey(key); },
    });
  };

  return (
    <>
      <PageTitle title="Mẫu email" subtitle="Nội dung các thư hệ thống gửi cho chủ hồ sơ và người được uỷ quyền." />
      <DeliveryNotice />
      {!canManage && <Alert type="info" showIcon style={{ marginBottom: 12 }} title="Bạn chỉ có quyền xem mẫu email." />}
      <ErrorAlert error={error} style={{ marginBottom: 12 }} />
      {isLoading ? <Skeleton active /> : templates && selected && (
        <div className="email-templates">
          <Card size="small" styles={{ body: { padding: 0 } }}>
            <List
              dataSource={templates}
              renderItem={(t) => (
                <List.Item onClick={() => select(t.key)} className={'email-template-item' + (t.key === selected.key ? ' active' : '')}>
                  <div style={{ minWidth: 0 }}>
                    <div><Typography.Text strong>{t.name}</Typography.Text>{t.isCustomized && <Tag color="gold" style={{ marginInlineStart: 6 }}>Đã sửa</Tag>}</div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t.description}</Typography.Text>
                  </div>
                </List.Item>
              )}
            />
          </Card>
          <EmailTemplateEditor key={selected.key} template={selected} canManage={canManage} onDirtyChange={setDirty} />
        </div>
      )}
    </>
  );
}
