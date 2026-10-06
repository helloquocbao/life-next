/**
 * NHÂN VIÊN — tài khoản vận hành và vai trò của họ.
 *
 * - Ai có quyền `DeathNote.Staff` được xem. Thêm / sửa thông tin & vai trò / khoá / đặt lại mật khẩu là bốn quyền
 *   riêng; form chỉ mở những ô người dùng có quyền (mỗi thay đổi ghi vào audit log).
 * - Backend chặn tự khoá mình và tự gỡ vai trò Quản trị hệ thống của mình.
 */
import { useState } from 'react';
import { Button, Input, Select, Space, Table, Tag, Typography, type TableColumnsType } from 'antd';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import type { StaffDto } from '@deathnote/api';
import { ErrorAlert, formatDate } from '@deathnote/ui';
import { useAssignableRoles, useProfile, useStaff } from '../lib/api-hooks';
import { hasPerm, Perm, roleColor, roleLabel } from '../lib/permissions';
import { PageTitle } from '../components/PageTitle';
import { StaffFormModal } from '../components/staff/StaffFormModal';

export function StaffPage() {
  const { data: profile } = useProfile();
  const can = {
    create: hasPerm(profile, Perm.StaffCreate),
    update: hasPerm(profile, Perm.StaffUpdate),
    lock: hasPerm(profile, Perm.StaffLock),
    resetPassword: hasPerm(profile, Perm.StaffResetPassword),
  };
  const canEdit = can.update || can.lock || can.resetPassword;
  const { data: roleNames } = useAssignableRoles();
  const roleOptions = (roleNames ?? []).map((r) => ({ value: r, label: roleLabel(r) }));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filter, setFilter] = useState<string>();
  const [role, setRole] = useState<string>();
  // undefined = đóng; null = thêm mới; StaffDto = đang sửa
  const [editing, setEditing] = useState<StaffDto | null>();
  const { data, isLoading, isFetching, error } = useStaff((page - 1) * pageSize, pageSize, filter, role);

  const columns: TableColumnsType<StaffDto> = [
    {
      title: 'Nhân viên', key: 'name', width: 260,
      render: (_, s) => (
        <div>
          <Typography.Text strong>{s.name || s.userName}</Typography.Text>
          <div><Typography.Text type="secondary" style={{ fontSize: 12 }}><span className="mono">{s.userName}</span> · {s.email}</Typography.Text></div>
        </div>
      ),
    },
    {
      title: 'Vai trò', dataIndex: 'roles',
      render: (roles: string[]) => (
        <Space size={4} wrap>
          {roles.map((r) => <Tag key={r} color={roleColor(r)} style={{ marginInlineEnd: 0 }}>{roleLabel(r)}</Tag>)}
        </Space>
      ),
    },
    {
      title: 'Trạng thái', dataIndex: 'isActive', width: 120,
      render: (v: boolean) => v ? <Tag color="green">Đang hoạt động</Tag> : <Tag color="red">Đã khoá</Tag>,
    },
    { title: 'Ngày tạo', dataIndex: 'creationTime', width: 120, render: (v: string) => formatDate(v) },
    ...(canEdit ? [{
      key: 'actions', width: 80, fixed: 'right' as const,
      render: (_: unknown, s: StaffDto) => <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(s)}>Sửa</Button>,
    }] : []),
  ];

  return (
    <>
      <PageTitle title="Nhân viên" subtitle="Tài khoản vận hành và vai trò quyết định họ được làm gì trong console này."
        extra={can.create && <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing(null)}>Thêm nhân viên</Button>} />
      <ErrorAlert error={error} style={{ marginBottom: 12 }} />
      <div className="panel">
        <div className="panel-toolbar">
          <Space wrap>
            <Input.Search allowClear placeholder="Tên đăng nhập, họ tên hoặc email" style={{ width: 320 }}
              onSearch={(v) => { setFilter(v.trim() || undefined); setPage(1); }} />
            <Select allowClear placeholder="Vai trò" style={{ width: 200 }} options={roleOptions} value={role}
              onChange={(v?: string) => { setRole(v); setPage(1); }} />
          </Space>
        </div>
        <Table<StaffDto>
          size="small"
          rowKey={(s) => s.id ?? ''}
          columns={columns}
          dataSource={data?.items ?? []}
          loading={isLoading || isFetching}
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page, pageSize, total: data?.totalCount ?? 0, showSizeChanger: true, pageSizeOptions: [20, 50, 100],
            showTotal: (t) => `${t} nhân viên`,
            onChange: (p, s) => { setPage(p); setPageSize(s); },
          }}
        />
      </div>
      {editing !== undefined && <StaffFormModal staff={editing} roleOptions={roleOptions} can={can} onClose={() => setEditing(undefined)} />}
    </>
  );
}
