/**
 * Cấu trúc dữ liệu RÕ (plaintext) — chỉ tồn tại trong bộ nhớ trình duyệt, không bao giờ gửi lên server.
 */

/** Loại hạng mục trong vault. Server không biết loại (nằm trong ciphertext). */
export type VaultItemKind =
  | 'account' // Tài khoản & mật khẩu
  | 'document' // Tài liệu / giấy tờ
  | 'letter' // Thư & lời nhắn để lại
  | 'instruction' // Hướng dẫn cho gia đình
  | 'real_estate' // Bất động sản / xe / tài sản
  | 'bank' // Tài khoản ngân hàng
  | 'insurance' // Bảo hiểm & BHXH
  | 'investment' // Đầu tư
  | 'debt' // Khoản vay / nợ
  | 'subscription'; // Thanh toán định kỳ cần huỷ

/** Một trường thông tin. Lưu kèm nhãn để app trustee hiển thị được mà không cần biết cấu trúc form của owner. */
export type ItemField = { key: string; label: string; value: string; secret?: boolean };

/** Tệp đính kèm nhỏ (ảnh chụp giấy tờ…), mã hoá cùng hạng mục. */
export type ItemAttachment = { name: string; type: string; size: number; dataB64: string };

export type VaultItemData = {
  v: 1;
  kind: VaultItemKind;
  title: string;
  fields: ItemField[];
  notes?: string;
  attachments?: ItemAttachment[];
  /** Với hạng mục "cần huỷ / cần làm": gợi ý việc cho checklist của gia đình. */
  todo?: string;
  updatedAt: string;
};

/** Ma trận phân bổ riêng của owner (mã hoá bằng VaultKey). */
export type Allocation = {
  v: 1;
  /** trusteeId → danh sách itemId được nhận. */
  assignments: Record<string, string[]>;
  /** trusteeId → thư mở đầu hiển thị trước mọi thứ khác khi hộp nhận được mở. */
  letters: Record<string, string>;
};

/** Nội dung grant một trustee nhận được sau khi hồ sơ được mở. */
export type GrantPayload = {
  v: 1;
  ownerName: string;
  generatedAt: string;
  letter?: string;
  items: { id: string; key: string; title: string; kind: VaultItemKind }[];
};
