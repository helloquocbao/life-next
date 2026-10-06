/**
 * VAI TRÒ & QUYỀN — vai trò được tạo động; mỗi vai trò chọn quyền từ cây quyền của console.
 *
 * - Quyền `DeathNote.Roles` để xem; tạo / sửa / xoá là ba quyền riêng (`Roles.Create` / `Roles.Update` / `Roles.Delete`).
 * - Vai trò Quản trị hệ thống (admin) luôn toàn quyền, không sửa/xoá được.
 * - Không xoá được vai trò còn nhân viên — gỡ vai trò khỏi họ ở trang Nhân viên trước.
 * - Đổi quyền có hiệu lực ngay ở lần gọi API kế tiếp của nhân viên; menu của họ cập nhật khi tải lại trang.
 * - Đổi TÊN vai trò: token đang dùng mang tên cũ → nhân viên đang đăng nhập cần đăng nhập lại.
 */
import { useState } from 'react';
import { App, Button, Popconfirm, Space, Table, Tag, Tooltip, Typography, type TableColumnsType } from 'antd';
import { DeleteOutlined, EditOutlined, LockOutlined, PlusOutlined } from '@ant-design/icons';
import type { RoleDto } from '@deathnote/api';
import { ErrorAlert, errorMessage } from '@deathnote/ui';
import { useDeleteRole, usePermissionCatalog, useProfile, useRoles } from '../lib/api-hooks';
import { hasPerm, Perm, roleColor, roleLabel } from '../lib/permissions';
import { PageTitle } from '../components/PageTitle';
import { RoleFormModal } from '../components/roles/RoleFormModal';

export function RolesPage() {
  const { message } = App.useApp();
  const { data: profile } = useProfile();
  const canCreate = hasPerm(profile, Perm.RolesCreate);
  const canUpdate = hasPerm(profile, Perm.RolesUpdate);
  const canDelete = hasPerm(profile, Perm.RolesDelete);
  const { data: roles, isLoading, error } = useRoles();
  const { data: catalog } = usePermissionCatalog();
  const remove = useDeleteRole();
  // undefined = đóng; null = tạo mới; RoleDto = đang sửa
  const [editing, setEditing] = useState<RoleDto | null>();

  const displayName = (name: string) => catalog?.find((p) => p.name === name)?.displayName ?? name;
  // Chỉ hiện quyền gốc trong bảng cho gọn; quyền con nằm trong form sửa.
  const rootGranted = (r: RoleDto) => (r.permissions ?? []).filter((n) => !catalog?.find((p) => p.name === n)?.parentName);

  const doDelete = async (r: RoleDto) => {
    try {
      await remove.mutateAsync(r.id!);
      message.success(`Đã xoá vai trò "${roleLabel(r.name!)}".`);
    } catch (e) {
      message.error(errorMessage(e));
    }
  };

  const columns: TableColumnsType<RoleDto> = [
    {
      title: 'Vai trò', dataIndex: 'name', width: 220,
      render: (name: string, r) => (
        <Space size={6}>
          <Tag color={roleColor(name)} style={{ marginInlineEnd: 0 }}>{roleLabel(name)}</Tag>
          {r.isStatic && <Tooltip title="Vai trò hệ thống — luôn toàn quyền"><LockOutlined style={{ color: 'var(--muted)' }} /></Tooltip>}
          {roleLabel(name) !== name && <Typography.Text type="secondary" className="mono">{name}</Typography.Text>}
        </Space>
      ),
    },
    { title: 'Nhân viên', dataIndex: 'userCount', width: 100, align: 'center' },
    {
      title: 'Quyền', key: 'permissions',
      render: (_, r) => r.isStatic ? <Tag color="magenta">Toàn quyền</Tag> : (
        <Space size={4} wrap>
          {rootGranted(r).length === 0 && <Typography.Text type="secondary">Chưa có quyền nào</Typography.Text>}
          {rootGranted(r).map((n) => <Tag key={n} style={{ marginInlineEnd: 0 }}>{displayName(n)}</Tag>)}
          {(r.permissions?.length ?? 0) > rootGranted(r).length && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>+{(r.permissions?.length ?? 0) - rootGranted(r).length} quyền chi tiết</Typography.Text>
          )}
        </Space>
      ),
    },
    ...(canUpdate || canDelete ? [{
      key: 'actions', width: 170, fixed: 'right' as const,
      render: (_: unknown, r: RoleDto) => r.isStatic ? null : (
        <Space size={4}>
          {canUpdate && <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(r)}>Sửa</Button>}
          {canDelete && <Popconfirm title={`Xoá vai trò "${roleLabel(r.name!)}"?`} okText="Xoá" cancelText="Huỷ" okButtonProps={{ danger: true }}
            disabled={(r.userCount ?? 0) > 0} onConfirm={() => doDelete(r)}>
            <Tooltip title={(r.userCount ?? 0) > 0 ? 'Còn nhân viên giữ vai trò này' : undefined}>
              <Button size="small" danger icon={<DeleteOutlined />} disabled={(r.userCount ?? 0) > 0}>Xoá</Button>
            </Tooltip>
          </Popconfirm>}
        </Space>
      ),
    }] : []),
  ];

  return (
    <>
      <PageTitle title="Vai trò & quyền" subtitle="Tạo vai trò theo nhu cầu vận hành và chọn chính xác những gì mỗi vai trò được làm."
        extra={canCreate && <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing(null)}>Tạo vai trò</Button>} />
      <ErrorAlert error={error} style={{ marginBottom: 12 }} />
      <div className="panel">
        <Table<RoleDto> size="small" rowKey={(r) => r.id ?? ''} columns={columns} dataSource={roles ?? []} loading={isLoading}
          scroll={{ x: 'max-content' }} pagination={false} />
      </div>
      {editing !== undefined && catalog && <RoleFormModal role={editing} catalog={catalog} onClose={() => setEditing(undefined)} />}
    </>
  );
}
