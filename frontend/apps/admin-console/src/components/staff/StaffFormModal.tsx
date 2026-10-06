/**
 * Form thêm / sửa nhân viên. Thêm mới: tên đăng nhập + mật khẩu ban đầu. Sửa: đổi họ tên, email, vai trò,
 * khoá/mở khoá; mật khẩu mới để trống = giữ nguyên. Tên đăng nhập không đổi được sau khi tạo.
 * Khi sửa, ô nào người dùng không có quyền thì bị khoá (backend vẫn kiểm từng thay đổi).
 */
import { App, Form, Input, Modal, Select, Switch } from 'antd';
import type { CreateStaffInput, StaffDto, UpdateStaffInput } from '@deathnote/api';
import { errorMessage } from '@deathnote/ui';
import { useSaveStaff } from '../../lib/api-hooks';

type Values = CreateStaffInput & UpdateStaffInput;

export function StaffFormModal({ staff, roleOptions, can, onClose }: {
  staff: StaffDto | null;
  roleOptions: { value: string; label: string }[];
  can: { update: boolean; lock: boolean; resetPassword: boolean };
  onClose: () => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const save = useSaveStaff(staff?.id);
  const isNew = !staff;
  const lockInfo = !isNew && !can.update;

  const submit = async (v: Values) => {
    try {
      await save.mutateAsync(isNew
        ? { userName: v.userName, name: v.name, email: v.email, password: v.password, roles: v.roles }
        : { name: v.name, email: v.email, roles: v.roles, isActive: v.isActive, newPassword: v.newPassword || undefined });
      message.success(isNew ? 'Đã thêm nhân viên.' : 'Đã lưu thay đổi.');
      onClose();
    } catch (e) {
      message.error(errorMessage(e));
    }
  };

  return (
    <Modal open title={isNew ? 'Thêm nhân viên' : `Sửa nhân viên — ${staff.userName}`} okText={isNew ? 'Thêm' : 'Lưu'} cancelText="Huỷ"
      onOk={() => form.submit()} onCancel={onClose} confirmLoading={save.isPending} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}
        initialValues={isNew ? { roles: [] } : { name: staff.name, email: staff.email, roles: staff.roles, isActive: staff.isActive }}>
        {isNew && (
          <Form.Item name="userName" label="Tên đăng nhập" rules={[{ required: true, message: 'Nhập tên đăng nhập' }]}>
            <Input autoComplete="off" />
          </Form.Item>
        )}
        <Form.Item name="name" label="Họ tên"><Input disabled={lockInfo} /></Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Email không hợp lệ' }]}>
          <Input autoComplete="off" disabled={lockInfo} />
        </Form.Item>
        <Form.Item name="roles" label="Vai trò" rules={[{ required: true, type: 'array', min: 1, message: 'Chọn ít nhất một vai trò' }]}>
          <Select mode="multiple" options={roleOptions} disabled={lockInfo} />
        </Form.Item>
        {isNew ? (
          <Form.Item name="password" label="Mật khẩu ban đầu" rules={[{ required: true, min: 6, message: 'Tối thiểu 6 ký tự' }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        ) : (
          <>
            {can.resetPassword && (
              <Form.Item name="newPassword" label="Đặt lại mật khẩu" extra="Để trống nếu không đổi." rules={[{ min: 6, message: 'Tối thiểu 6 ký tự' }]}>
                <Input.Password autoComplete="new-password" />
              </Form.Item>
            )}
            <Form.Item name="isActive" label="Cho phép đăng nhập" valuePropName="checked">
              <Switch checkedChildren="Hoạt động" unCheckedChildren="Đã khoá" disabled={!can.lock} />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
}
