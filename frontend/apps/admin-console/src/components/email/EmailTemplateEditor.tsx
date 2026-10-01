/**
 * Trình soạn một mẫu email: tiêu đề + nội dung HTML, chèn biến tại vị trí con trỏ, xem trước trực tiếp.
 * Xem trước gọi backend (cùng bộ render với thư thật) nên lỗi biến không hợp lệ hiện ngay khi gõ.
 */
import { useEffect, useRef, useState } from 'react';
import { App, Button, Card, Input, Popconfirm, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import type { InputRef } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import { RollbackOutlined, SaveOutlined, SendOutlined, UndoOutlined } from '@ant-design/icons';
import type { EmailTemplateDto } from '@deathnote/api';
import { ErrorAlert, errorMessage, formatDateTime } from '@deathnote/ui';
import { useEmailPreview, useResetEmailTemplate, useSaveEmailTemplate } from '../../lib/api-hooks';
import { SendTestModal } from './SendTestModal';

type Field = 'subject' | 'bodyHtml';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function EmailTemplateEditor({ template, canManage, onDirtyChange }: {
  template: EmailTemplateDto;
  canManage: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { message } = App.useApp();
  const [draft, setDraft] = useState({ subject: template.subject, bodyHtml: template.bodyHtml });
  const [testOpen, setTestOpen] = useState(false);
  const lastField = useRef<Field>('bodyHtml');
  const subjectRef = useRef<InputRef>(null);
  const bodyRef = useRef<TextAreaRef>(null);

  const save = useSaveEmailTemplate(template.key);
  const reset = useResetEmailTemplate(template.key);
  const preview = useEmailPreview(template.key, useDebounced(draft, 400));

  const isLayout = template.key === 'layout';
  const dirty = draft.subject !== template.subject || draft.bodyHtml !== template.bodyHtml;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  /** Chèn {{name}} vào ô vừa focus, đúng vị trí con trỏ. */
  const insert = (name: string) => {
    const field = lastField.current;
    const el = field === 'subject' ? subjectRef.current?.input : bodyRef.current?.resizableTextArea?.textArea;
    const token = `{{${name}}}`;
    const value = draft[field];
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    setDraft({ ...draft, [field]: value.slice(0, start) + token + value.slice(end) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const onSave = async () => {
    try {
      const saved = await save.mutateAsync(draft);
      setDraft({ subject: saved.subject, bodyHtml: saved.bodyHtml });
      message.success('Đã lưu mẫu email. Các thư gửi từ bây giờ sẽ dùng nội dung mới.');
    } catch (e) {
      message.error(errorMessage(e));
    }
  };

  const onReset = async () => {
    try {
      const restored = await reset.mutateAsync();
      setDraft({ subject: restored.subject, bodyHtml: restored.bodyHtml });
      message.success('Đã khôi phục nội dung mặc định.');
    } catch (e) {
      message.error(errorMessage(e));
    }
  };

  return (
    <div className="email-editor">
      <Card size="small" title={template.name}
        extra={template.isCustomized
          ? <Tag color="gold">Đã sửa{template.lastModifiedAt ? ` · ${formatDateTime(template.lastModifiedAt)}` : ''}</Tag>
          : <Tag>Mặc định</Tag>}>
        <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>{template.description}</Typography.Paragraph>

        {/* Khung chung không có tiêu đề riêng: tiêu đề email luôn là tiêu đề của từng thư. */}
        {!isLayout && (
          <>
            <Typography.Text strong>Tiêu đề</Typography.Text>
            <Input ref={subjectRef} value={draft.subject} readOnly={!canManage} maxLength={256} style={{ margin: '4px 0 12px' }}
              onFocus={() => (lastField.current = 'subject')}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
          </>
        )}

        <Typography.Text strong>Nội dung (HTML)</Typography.Text>
        <Input.TextArea ref={bodyRef} value={draft.bodyHtml} readOnly={!canManage} className="mono"
          autoSize={{ minRows: 12, maxRows: 28 }} style={{ margin: '4px 0 12px' }}
          onFocus={() => (lastField.current = 'bodyHtml')}
          onChange={(e) => setDraft({ ...draft, bodyHtml: e.target.value })} />

        <Typography.Text strong>Biến có thể dùng</Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
          {canManage ? 'Bấm để chèn vào ô đang soạn. ' : ''}Giá trị được tự động mã hoá HTML khi gửi.
        </Typography.Text>
        <Space size={[6, 6]} wrap style={{ marginBottom: 16 }}>
          {template.placeholders?.map((p) => (
            <Tooltip key={p.name} title={<>{p.description}<br />Ví dụ: {p.sampleValue}</>}>
              <Tag className="placeholder-tag" color="green" onClick={canManage ? () => insert(p.name) : undefined}>{`{{${p.name}}}`}</Tag>
            </Tooltip>
          ))}
        </Space>

        {canManage && (
          <Space wrap>
            <Button type="primary" icon={<SaveOutlined />} disabled={!dirty} loading={save.isPending} onClick={() => void onSave()}>Lưu</Button>
            <Button icon={<UndoOutlined />} disabled={!dirty} onClick={() => setDraft({ subject: template.subject, bodyHtml: template.bodyHtml })}>Bỏ thay đổi</Button>
            <Popconfirm title="Khôi phục nội dung mặc định?" description="Bản tuỳ chỉnh hiện tại sẽ bị xoá." okText="Khôi phục" cancelText="Huỷ"
              disabled={!template.isCustomized} onConfirm={() => void onReset()}>
              <Button icon={<RollbackOutlined />} disabled={!template.isCustomized} loading={reset.isPending}>Khôi phục mặc định</Button>
            </Popconfirm>
            <Button icon={<SendOutlined />} onClick={() => setTestOpen(true)}>Gửi thử</Button>
          </Space>
        )}
      </Card>

      <Card size="small" title="Xem trước" extra={preview.isFetching && <Spin size="small" />}
        styles={{ body: { padding: 0 } }}>
        <ErrorAlert error={preview.error} style={{ margin: 12 }} />
        {preview.data && (
          <>
            <div className="email-preview-subject">
              <Typography.Text type="secondary">Tiêu đề: </Typography.Text><Typography.Text strong>{preview.data.subject}</Typography.Text>
            </div>
            {/* sandbox rỗng: không chạy script, không điều hướng — chỉ hiển thị HTML. */}
            <iframe title="Xem trước email" className="email-preview-frame" sandbox="" srcDoc={preview.data.html} />
          </>
        )}
      </Card>

      <SendTestModal open={testOpen} templateKey={template.key} draft={draft} onClose={() => setTestOpen(false)} />
    </div>
  );
}
