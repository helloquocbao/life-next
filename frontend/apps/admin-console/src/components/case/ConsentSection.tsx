/**
 * KHỐI 3 — Đồng thuận: ai đã đồng ý mở, từ đâu (IP), bằng thiết bị gì, và lời khai của họ.
 *
 * IP/thiết bị là dấu hiệu quan trọng chống thông đồng: nhiều người "độc lập" cùng một IP/thiết bị
 * là cờ đỏ (backend có thể loại phiếu trùng IP khi bật EnforceDistinctConsentIp).
 * Bên dưới là toàn bộ trustees của owner để người duyệt thấy bối cảnh: ai chưa đồng ý, ai mới được thêm gần đây.
 */
import { Table, Tag, Tooltip, Typography, type TableColumnsType } from 'antd';
import type { TrusteeRole, TrusteeStatus } from '@deathnote/api';
import { contactResponseLabel, formatDate, formatDateTime, trusteeRoleLabel, trusteeStatusColor, trusteeStatusLabel } from '@deathnote/ui';
import type { CaseConsentDto, CaseTrusteeDto } from '../../lib/types';

/** Rút gọn user agent thành "Trình duyệt · Hệ điều hành" — chuỗi đầy đủ nằm trong tooltip. */
export function shortUserAgent(ua?: string | null): string {
  if (!ua) return '—';
  const browser =
    /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' :
    /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : /curl|python|okhttp/i.test(ua) ? 'Script/Bot' : 'Khác';
  const os =
    /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' :
    /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} · ${os}` : browser;
}

export function ConsentSection({ consents, trustees, required, effective }: {
  consents: CaseConsentDto[]; trustees: CaseTrusteeDto[]; required: number; effective: number;
}) {
  const consentColumns: TableColumnsType<CaseConsentDto> = [
    { title: 'Người đồng ý', dataIndex: 'trusteeName', width: 140, render: (v: string) => <Typography.Text strong>{v}</Typography.Text> },
    { title: 'Quan hệ', dataIndex: 'relationship', width: 90, render: (v?: string | null) => v || '—' },
    { title: 'Thời điểm', dataIndex: 'consentedAt', width: 130, render: (v: string) => formatDateTime(v) },
    { title: 'IP', dataIndex: 'ipAddress', width: 120, render: (v?: string | null) => <span className="mono">{v || '—'}</span> },
    {
      title: 'Thiết bị', dataIndex: 'userAgent', width: 130,
      render: (v?: string | null) => <Tooltip title={v}><span>{shortUserAgent(v)}</span></Tooltip>,
    },
    {
      title: 'Lời khai', dataIndex: 'statement',
      render: (v?: string | null) => v ? <Typography.Paragraph style={{ margin: 0, fontSize: 13 }} ellipsis={{ rows: 2, expandable: true, symbol: 'xem thêm' }}>{v}</Typography.Paragraph> : '—',
    },
  ];

  const trusteeColumns: TableColumnsType<CaseTrusteeDto> = [
    { title: 'Người được uỷ quyền', dataIndex: 'displayName', width: 150 },
    { title: 'Quan hệ', dataIndex: 'relationship', width: 90, render: (v?: string | null) => v || '—' },
    { title: 'Vai trò', dataIndex: 'role', width: 150, render: (v: TrusteeRole) => trusteeRoleLabel[v] },
    { title: 'Trạng thái', dataIndex: 'status', width: 120, render: (v: TrusteeStatus) => <Tag color={trusteeStatusColor[v]}>{trusteeStatusLabel[v]}</Tag> },
    { title: 'Ngày thêm', dataIndex: 'addedAt', width: 100, render: (v: string) => formatDate(v) },
    {
      title: 'Phản hồi liên lạc', key: 'contact',
      // lastContactResponse mặc định = 0 kể cả khi chưa từng phản hồi → chỉ tin khi có thời điểm phản hồi.
      render: (_, t) => t.lastContactResponseAt && t.lastContactResponse != null ? (
        <span>
          <Tag color={t.lastContactResponse === 0 ? 'green' : 'red'}>{contactResponseLabel[t.lastContactResponse]}</Tag>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{formatDateTime(t.lastContactResponseAt)}</Typography.Text>
        </span>
      ) : <Typography.Text type="secondary">Chưa phản hồi</Typography.Text>,
    },
  ];

  return (
    <>
      <Typography.Paragraph style={{ marginBottom: 8 }}>
        Đồng thuận hợp lệ: <Typography.Text strong>{effective}/{required}</Typography.Text>
        {consents.length > effective && (
          <Typography.Text type="warning"> — {consents.length - effective} phiếu không được tính (trùng IP)</Typography.Text>
        )}
      </Typography.Paragraph>
      <Table<CaseConsentDto> size="small" rowKey={(c, i) => `${c.trusteeName}-${c.consentedAt}-${i}`} columns={consentColumns}
        dataSource={consents} pagination={false} scroll={{ x: 820 }} locale={{ emptyText: 'Chưa có ai đồng thuận' }} />
      <Typography.Title level={5} style={{ fontSize: 13, margin: '16px 0 8px' }}>Toàn bộ người được uỷ quyền của owner ({trustees.length})</Typography.Title>
      <Table<CaseTrusteeDto> size="small" rowKey={(t, i) => `${t.displayName}-${t.addedAt}-${i}`} columns={trusteeColumns}
        dataSource={trustees} pagination={false} scroll={{ x: 820 }} />
    </>
  );
}
