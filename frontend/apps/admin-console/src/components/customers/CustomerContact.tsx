/**
 * Email & SĐT của một khách hàng: mặc định hiện dạng che từ danh sách. Người có quyền bấm 👁 để lấy bản đầy đủ
 * (backend ghi audit), bấm lần nữa để che lại. Bản đầy đủ chỉ nằm trong state của dòng này, không vào cache.
 */
import { useState } from 'react';
import { App, Button, Space, Tooltip, Typography } from 'antd';
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import type { CustomerContactDto, CustomerDto } from '@deathnote/api';
import { errorMessage } from '@deathnote/ui';
import { useRevealContact } from '../../lib/api-hooks';

export function CustomerContact({ customer: c, canReveal }: { customer: CustomerDto; canReveal: boolean }) {
  const { message } = App.useApp();
  const reveal = useRevealContact();
  const [contact, setContact] = useState<CustomerContactDto | null>(null);

  const toggle = async () => {
    if (contact) return setContact(null);
    try {
      setContact(await reveal.mutateAsync(c.id!));
    } catch (e) {
      message.error(errorMessage(e));
    }
  };

  const email = contact?.email ?? c.maskedEmail;
  const phone = contact ? contact.phoneNumber : c.maskedPhoneNumber;
  return (
    <Space size={4} align="center" style={{ display: 'flex' }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }} copyable={contact ? { text: [email, phone].filter(Boolean).join(' · ') } : false}>
        {email}{phone ? ` · ${phone}` : ''}
      </Typography.Text>
      {canReveal && (
        <Tooltip title={contact ? 'Che lại' : 'Xem email & SĐT (được ghi vào audit log)'}>
          <Button type="text" size="small" loading={reveal.isPending} icon={contact ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            aria-label={contact ? 'Che email và số điện thoại' : 'Xem email và số điện thoại'} onClick={() => void toggle()} />
        </Tooltip>
      )}
    </Space>
  );
}
