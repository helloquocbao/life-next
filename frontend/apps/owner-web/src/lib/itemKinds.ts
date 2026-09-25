/**
 * Danh mục loại hạng mục + form riêng cho từng loại (tài liệu: "Chọn loại trước → form riêng theo loại,
 * không dùng form chung"). Mỗi trường lưu kèm nhãn trong ciphertext để app trustee hiển thị lại được.
 */
import type { VaultItemKind } from '@deathnote/crypto';

export type FieldDef = { key: string; label: string; secret?: boolean; multiline?: boolean; placeholder?: string };

export type KindDef = {
  kind: VaultItemKind;
  label: string;
  emoji: string;
  /** "vault" = Két thông tin, "assets" = Tài sản & quyền lợi. */
  section: 'vault' | 'assets';
  description: string;
  fields: FieldDef[];
  /** Gợi ý việc gia đình cần làm (sinh checklist cho trustee). */
  todoHint?: string;
};

export const KINDS: KindDef[] = [
  {
    kind: 'account', label: 'Tài khoản & mật khẩu', emoji: '🔑', section: 'vault',
    description: 'Email, mạng xã hội, ví điện tử, ứng dụng ngân hàng…',
    fields: [
      { key: 'service', label: 'Dịch vụ / website', placeholder: 'Gmail, Facebook, MoMo…' },
      { key: 'username', label: 'Tên đăng nhập' },
      { key: 'password', label: 'Mật khẩu', secret: true },
      { key: 'twofa', label: 'Mã dự phòng 2FA', secret: true, multiline: true },
      { key: 'wish', label: 'Mong muốn xử lý', placeholder: 'Đóng tài khoản / giữ làm kỷ niệm / chuyển cho…' },
    ],
    todoHint: 'Xử lý tài khoản online',
  },
  {
    kind: 'document', label: 'Tài liệu / giấy tờ', emoji: '📄', section: 'vault',
    description: 'CCCD, sổ đỏ, hợp đồng, giấy tờ xe — kèm ảnh chụp và nơi cất bản gốc.',
    fields: [
      { key: 'docType', label: 'Loại giấy tờ' },
      { key: 'number', label: 'Số hiệu', secret: true },
      { key: 'location', label: 'Bản gốc cất ở đâu' },
    ],
  },
  {
    kind: 'letter', label: 'Thư & lời nhắn để lại', emoji: '✉️', section: 'vault',
    description: 'Những điều bạn muốn nói với người thân.',
    fields: [
      { key: 'to', label: 'Gửi tới' },
      { key: 'content', label: 'Nội dung', multiline: true },
    ],
  },
  {
    kind: 'instruction', label: 'Hướng dẫn cho gia đình', emoji: '🧭', section: 'vault',
    description: 'Việc cần làm, người cần liên hệ, mong muốn về tang lễ…',
    fields: [
      { key: 'topic', label: 'Chủ đề' },
      { key: 'steps', label: 'Các bước', multiline: true },
      { key: 'contact', label: 'Người liên hệ' },
    ],
  },
  {
    kind: 'real_estate', label: 'Bất động sản / xe / tài sản', emoji: '🏠', section: 'assets',
    description: 'Nhà đất, xe, vàng, tài sản có giá trị.',
    fields: [
      { key: 'asset', label: 'Tài sản' },
      { key: 'address', label: 'Địa chỉ / biển số' },
      { key: 'papers', label: 'Giấy tờ sở hữu cất ở đâu' },
      { key: 'coOwner', label: 'Đồng sở hữu (nếu có)' },
    ],
    todoHint: 'Làm thủ tục tài sản',
  },
  {
    kind: 'bank', label: 'Tài khoản ngân hàng', emoji: '🏦', section: 'assets',
    description: 'Tài khoản thanh toán, tiết kiệm, thẻ tín dụng.',
    fields: [
      { key: 'bank', label: 'Ngân hàng' },
      { key: 'branch', label: 'Chi nhánh' },
      { key: 'account', label: 'Số tài khoản', secret: true },
      { key: 'type', label: 'Loại (thanh toán / tiết kiệm / thẻ)' },
      { key: 'contact', label: 'Liên hệ (RM, hotline)' },
    ],
    todoHint: 'Liên hệ ngân hàng',
  },
  {
    kind: 'insurance', label: 'Bảo hiểm & BHXH', emoji: '🛡️', section: 'assets',
    description: 'Bảo hiểm nhân thọ, sức khoẻ, sổ BHXH.',
    fields: [
      { key: 'insurer', label: 'Công ty / cơ quan' },
      { key: 'policy', label: 'Số hợp đồng / số sổ', secret: true },
      { key: 'beneficiary', label: 'Người thụ hưởng' },
      { key: 'agent', label: 'Tư vấn viên / liên hệ' },
      { key: 'location', label: 'Hợp đồng gốc cất ở đâu' },
    ],
    todoHint: 'Báo cho bảo hiểm',
  },
  {
    kind: 'investment', label: 'Đầu tư', emoji: '📈', section: 'assets',
    description: 'Chứng khoán, quỹ, crypto, góp vốn.',
    fields: [
      { key: 'platform', label: 'Công ty chứng khoán / sàn' },
      { key: 'account', label: 'Số tài khoản', secret: true },
      { key: 'holdings', label: 'Danh mục chính', multiline: true },
    ],
    todoHint: 'Xử lý tài khoản đầu tư',
  },
  {
    kind: 'debt', label: 'Khoản vay / nợ', emoji: '📑', section: 'assets',
    description: 'Vay mua nhà, vay tiêu dùng, cho người khác vay.',
    fields: [
      { key: 'lender', label: 'Bên cho vay / bên vay' },
      { key: 'amount', label: 'Số tiền còn lại' },
      { key: 'contract', label: 'Số hợp đồng', secret: true },
      { key: 'due', label: 'Kỳ hạn' },
    ],
    todoHint: 'Xử lý khoản vay',
  },
  {
    kind: 'subscription', label: 'Thanh toán định kỳ cần huỷ', emoji: '🔁', section: 'assets',
    description: 'Netflix, điện thoại, phí tự động — việc gia đình thường quên.',
    fields: [
      { key: 'service', label: 'Dịch vụ' },
      { key: 'amount', label: 'Số tiền / kỳ' },
      { key: 'payment', label: 'Trừ từ tài khoản/thẻ nào' },
      { key: 'howToCancel', label: 'Cách huỷ', multiline: true },
    ],
    todoHint: 'Huỷ thanh toán định kỳ',
  },
];

export const kindDef = (k: VaultItemKind): KindDef => KINDS.find((x) => x.kind === k) ?? KINDS[0];

/**
 * Bộ câu hỏi chủ động cho "Tài sản & quyền lợi": app hỏi từng câu thay vì đưa bảng trống.
 */
export const ASSET_QUESTIONS: { id: string; question: string; kind: VaultItemKind; suggestedTitle: string }[] = [
  { id: 'bhxh', question: 'Bạn có sổ Bảo hiểm xã hội (BHXH) không?', kind: 'insurance', suggestedTitle: 'Sổ BHXH' },
  { id: 'life', question: 'Bạn có hợp đồng bảo hiểm nhân thọ nào không?', kind: 'insurance', suggestedTitle: 'Bảo hiểm nhân thọ' },
  { id: 'health', question: 'Bạn có bảo hiểm sức khoẻ riêng không?', kind: 'insurance', suggestedTitle: 'Bảo hiểm sức khoẻ' },
  { id: 'saving', question: 'Bạn có sổ tiết kiệm ngân hàng không?', kind: 'bank', suggestedTitle: 'Sổ tiết kiệm' },
  { id: 'payment', question: 'Tài khoản ngân hàng bạn dùng hằng ngày?', kind: 'bank', suggestedTitle: 'Tài khoản thanh toán' },
  { id: 'house', question: 'Bạn có nhà / đất đứng tên không?', kind: 'real_estate', suggestedTitle: 'Nhà đất' },
  { id: 'vehicle', question: 'Bạn có xe máy / ô tô đứng tên không?', kind: 'real_estate', suggestedTitle: 'Xe' },
  { id: 'stock', question: 'Bạn có tài khoản chứng khoán hay quỹ đầu tư không?', kind: 'investment', suggestedTitle: 'Tài khoản chứng khoán' },
  { id: 'loan', question: 'Bạn có khoản vay nào đang trả góp không?', kind: 'debt', suggestedTitle: 'Khoản vay' },
  { id: 'lend', question: 'Có ai đang nợ tiền bạn không?', kind: 'debt', suggestedTitle: 'Cho vay' },
  { id: 'subs', question: 'Bạn có dịch vụ trả phí tự động hằng tháng không?', kind: 'subscription', suggestedTitle: 'Dịch vụ định kỳ' },
];
