/**
 * Luồng mở hộp nhận — toàn bộ phần giải mã diễn ra trên trình duyệt của trustee:
 *
 *   passphrase ──Argon2id──▶ KEK ──▶ mở khoá riêng (X25519)
 *   GET inbox ──▶ các mảnh Shamir đã niêm phong cho mình + grant (niêm phong 2 lớp)
 *   mở từng mảnh bằng khoá riêng ──▶ ghép ≥ m mảnh ──▶ ReleaseKey
 *   mở grant: lớp ngoài bằng khoá riêng, lớp trong bằng ReleaseKey ──▶ GrantPayload (thư + ItemKey)
 *   GET released-items ──▶ ciphertext ──ItemKey──▶ nội dung hạng mục
 *
 * Server chỉ thấy ciphertext; nó không biết trustee được phân mục nào (grant đã mã hoá).
 */
import { unwrap, type KeyringDto } from '@deathnote/api';
import { decryptItemWithKey, openInbox, wipe } from '@deathnote/crypto';
import { api } from '../config';
import { unlockWithPassphrase } from './keyring';
import type { OpenedInbox, OpenedItem } from '../session/inboxSession';

/** Chia nhỏ danh sách id khi gọi released-items để URL không quá dài. */
const CHUNK = 40;

export type InboxProgress = (step: string) => void;

export async function openInboxWithPassphrase(
  trusteeId: string,
  keyring: KeyringDto | undefined,
  passphrase: string,
  onProgress: InboxProgress = () => {},
): Promise<OpenedInbox> {
  // Bước 1: mở khoá cá nhân. Khoá riêng chỉ sống trong hàm này và bị ghi đè 0 ở `finally`.
  onProgress('Đang mở khoá cá nhân của bạn…');
  const keys = await unlockWithPassphrase(keyring, passphrase);

  try {
    // Bước 2: lấy các mảnh khoá + grant đã niêm phong cho mình.
    onProgress('Đang tải các mảnh khoá…');
    const inbox = await unwrap(api.GET('/api/app/trustee-portal/inbox/{trusteeId}', { params: { path: { trusteeId } } }));
    const sealedShares = inbox.sealedShares ?? [];
    const threshold = inbox.threshold ?? 0;
    if (sealedShares.length < threshold)
      throw new Error(`Chưa đủ mảnh khoá (${sealedShares.length}/${threshold}). Vui lòng thử lại sau ít phút.`);

    // Bước 3: ghép khoá Shamir và mở grant — chỉ trên trình duyệt này.
    onProgress('Đang ghép khoá và mở phần được giao cho bạn…');
    let grant;
    try {
      grant = await openInbox({ keys, sealedShares, threshold, sealedGrant: inbox.sealedGrant });
    } catch {
      throw new Error('Không ghép được khoá từ các mảnh nhận được. Vui lòng liên hệ PICO để được hỗ trợ.');
    }
    if (!grant) throw new Error('Người uỷ quyền không phân hạng mục nào cho bạn trong hồ sơ này.');

    // Bước 4: tải ciphertext các hạng mục được phân rồi giải mã bằng ItemKey trong grant.
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
  } finally {
    wipe(keys.privateKey); // khoá riêng không còn cần nữa — xoá khỏi RAM ngay
  }
}
