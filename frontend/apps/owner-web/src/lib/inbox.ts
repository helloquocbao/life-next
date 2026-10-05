/**
 * Luồng mở hộp nhận — toàn bộ phần giải mã diễn ra trên trình duyệt của người nhận:
 *
 *   GET inbox ──▶ grant đã mã hoá + "khoá giao hàng" của riêng mình (server chỉ trao sau khi hồ sơ bàn giao)
 *   giải mã grant bằng khoá giao hàng ──▶ GrantPayload (thư + ItemKey các hạng mục được phân)
 *   GET released-items ──▶ ciphertext ──ItemKey──▶ nội dung hạng mục
 *
 * Người nhận không cần passphrase hay khoá cá nhân: chỉ cần đăng nhập (xác thực bằng link trong email).
 */
import { unwrap } from '@deathnote/api';
import { decryptItemWithKey, openGrant } from '@deathnote/crypto';
import { api } from '../config';
import type { OpenedInbox, OpenedItem } from '../session/inboxSession';

/** Chia nhỏ danh sách id khi gọi released-items để URL không quá dài. */
const CHUNK = 40;

export type InboxProgress = (step: string) => void;

export async function openInboxFor(trusteeId: string, onProgress: InboxProgress = () => {}): Promise<OpenedInbox> {
  onProgress('Đang tải phần dành cho bạn…');
  const inbox = await unwrap(api.GET('/api/app/trustee-portal/inbox/{trusteeId}', { params: { path: { trusteeId } } }));

  onProgress('Đang mở phần được giao cho bạn…');
  let grant;
  try {
    grant = await openGrant({ encryptedGrant: inbox.encryptedGrant, deliveryKey: inbox.deliveryKey });
  } catch {
    throw new Error('Không mở được phần dành cho bạn. Có thể phần này đã thay đổi — vui lòng liên hệ người thân của owner hoặc đội hỗ trợ.');
  }
  if (!grant) throw new Error('Người uỷ quyền không phân hạng mục nào cho bạn trong hồ sơ này.');

  onProgress('Đang giải mã các hạng mục…');
  const items: OpenedItem[] = [];
  const keyById = new Map(grant.items.map((i) => [i.id, i.key]));
  const ids = grant.items.map((i) => i.id);
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const released = await unwrap(
      api.GET('/api/app/trustee-portal/released-items', { params: { query: { TrusteeId: trusteeId, Ids: chunk } } }),
    );
    const byId = new Map(released.map((r) => [r.id, r.ciphertext]));
    for (const id of chunk) {
      const ciphertext = byId.get(id);
      const key = keyById.get(id);
      if (!ciphertext || !key) {
        items.push({ id, error: 'Hạng mục này không còn trên hệ thống (có thể owner đã xoá).' });
        continue;
      }
      try {
        items.push({ id, data: await decryptItemWithKey(ciphertext, key) });
      } catch {
        items.push({ id, error: 'Không giải mã được hạng mục này.' });
      }
    }
  }

  return {
    ownerName: grant.ownerName || inbox.ownerName || '',
    releasedAt: inbox.releasedAt,
    grant,
    items,
    letterSeen: !grant.letter?.trim(), // không có thư thì coi như đã đọc
  };
}
