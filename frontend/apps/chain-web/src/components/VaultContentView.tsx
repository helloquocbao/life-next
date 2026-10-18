/** Hiển thị nội dung két đã giải mã: các mục thông tin + tệp tải về. Mục "bí mật" mặc định che. */
import { useState } from 'react';
import { Button, Descriptions, Empty, List, Typography } from 'antd';
import { DownloadOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { fromBase64, type VaultContent, type VaultFile } from '@deathnote/chain';

function download(f: VaultFile) {
  const url = URL.createObjectURL(new Blob([fromBase64(f.dataB64) as BlobPart], { type: f.type || 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = f.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function SecretValue({ value }: { value: string }) {
  const [shown, setShown] = useState(false);
  return (
    <span>
      <Typography.Text copyable={{ text: value }}>{shown ? value : '••••••••'}</Typography.Text>
      <Button type="link" size="small" icon={shown ? <EyeInvisibleOutlined /> : <EyeOutlined />} onClick={() => setShown(!shown)} />
    </span>
  );
}

export function VaultContentView({ content }: { content: VaultContent }) {
  return (
    <div>
      {content.note && <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>{content.note}</Typography.Paragraph>}
      {content.entries.length > 0 ? (
        <Descriptions bordered size="small" column={1}
          items={content.entries.map((e, i) => ({
            key: i,
            label: e.label,
            children: e.secret ? <SecretValue value={e.value} /> : <Typography.Text copyable>{e.value}</Typography.Text>,
          }))} />
      ) : (
        <Empty description="Không có mục thông tin" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
      {content.files.length > 0 && (
        <List style={{ marginTop: 16 }} header={<b>Tệp tài liệu</b>} bordered size="small" dataSource={content.files}
          renderItem={(f) => (
            <List.Item actions={[<Button key="d" size="small" icon={<DownloadOutlined />} onClick={() => download(f)}>Tải về</Button>]}>
              {f.name} <Typography.Text type="secondary">({Math.ceil(f.size / 1024)} KB)</Typography.Text>
            </List.Item>
          )} />
      )}
    </div>
  );
}
