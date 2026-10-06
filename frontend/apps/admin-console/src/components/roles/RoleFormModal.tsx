/**
 * Form tạo / sửa vai trò: tên + cây quyền có ô chọn. Chọn quyền con thì quyền cha được chọn kèm, bỏ quyền cha thì
 * bỏ luôn quyền con (backend cũng tự bổ sung quyền cha), vì quyền con không có nghĩa khi thiếu quyền cha.
 */
import { useMemo, useState } from 'react';
import { App, Form, Input, Modal, Tree, Typography, type TreeDataNode } from 'antd';
import type { PermissionItemDto, RoleDto } from '@deathnote/api';
import { errorMessage } from '@deathnote/ui';
import { useSaveRole } from '../../lib/api-hooks';

function buildTree(catalog: PermissionItemDto[], parent: string | null = null): TreeDataNode[] {
  return catalog
    .filter((p) => (p.parentName ?? null) === parent)
    .map((p) => ({ key: p.name!, title: p.displayName, children: buildTree(catalog, p.name!) }));
}

export function RoleFormModal({ role, catalog, onClose }: { role: RoleDto | null; catalog: PermissionItemDto[]; onClose: () => void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<{ name: string }>();
  const save = useSaveRole(role?.id);
  const isNew = !role;
  const tree = useMemo(() => buildTree(catalog), [catalog]);
  const parentOf = useMemo(() => new Map(catalog.map((p) => [p.name!, p.parentName ?? null])), [catalog]);

  // Mỗi quyền là một ô độc lập (checkStrictly): quyền cha ("Xem chính sách") có nghĩa riêng, không phải "chọn hết con".
  const [checked, setChecked] = useState<string[]>(role?.permissions ?? []);

  const ancestors = (n: string) => {
    const out: string[] = [];
    for (let p = parentOf.get(n) ?? null; p; p = parentOf.get(p) ?? null) out.push(p);
    return out;
  };
  const descendants = (n: string): string[] =>
    catalog.filter((p) => p.parentName === n).flatMap((c) => [c.name!, ...descendants(c.name!)]);

  /** Chọn quyền con → chọn kèm quyền cha; bỏ quyền cha → bỏ luôn quyền con. */
  const toggle = (name: string, on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) [name, ...ancestors(name)].forEach((n) => next.add(n));
      else [name, ...descendants(name)].forEach((n) => next.delete(n));
      return [...next];
    });

  const submit = async ({ name }: { name: string }) => {
    try {
      await save.mutateAsync({ name: name.trim(), permissions: checked });
      message.success(isNew ? 'Đã tạo vai trò.' : 'Đã lưu vai trò.');
      onClose();
    } catch (e) {
      message.error(errorMessage(e));
    }
  };

  return (
    <Modal open width={560} title={isNew ? 'Tạo vai trò' : `Sửa vai trò — ${role.name}`} okText={isNew ? 'Tạo' : 'Lưu'} cancelText="Huỷ"
      onOk={() => form.submit()} onCancel={onClose} confirmLoading={save.isPending} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={submit} requiredMark={false} initialValues={{ name: role?.name ?? '' }}>
        <Form.Item name="name" label="Tên vai trò" rules={[{ required: true, min: 2, max: 64, message: 'Tên từ 2 đến 64 ký tự' }]}
          extra={!isNew && 'Nhân viên vẫn giữ vai trò sau khi đổi tên, nhưng ai đang đăng nhập cần đăng nhập lại mới có quyền trở lại.'}>
          <Input placeholder="vd. Chăm sóc khách hàng" />
        </Form.Item>
        <Form.Item label="Quyền" style={{ marginBottom: 0 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            Chọn quyền con (vd. "Sửa chính sách") sẽ tự chọn kèm quyền cha ("Xem chính sách vòng đời").
          </Typography.Text>
          <div className="role-permission-tree">
            <Tree checkable checkStrictly selectable={false} defaultExpandAll treeData={tree} checkedKeys={{ checked, halfChecked: [] }}
              onCheck={(_, info) => toggle(String(info.node.key), info.checked)} />
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}
