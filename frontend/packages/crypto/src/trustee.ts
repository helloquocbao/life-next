/**
 * Mật mã phía NGƯỜI NHẬN thông tin: sau khi hồ sơ được bàn giao, server trao "khoá giao hàng" của riêng họ; họ dùng nó để
 * giải mã grant (thư + danh sách hạng mục kèm ItemKey) ngay trên trình duyệt, rồi giải mã từng hạng mục.
 */
import { fromBase64, wipe } from './encoding';
import { Context, decryptJson } from './primitives';
import type { GrantPayload } from './types';

/** Giải mã grant bằng khoá giao hàng. Trả null nếu owner không phân gì cho người này. */
export async function openGrant(args: { encryptedGrant?: string | null; deliveryKey?: string | null }): Promise<GrantPayload | null> {
  if (!args.encryptedGrant || !args.deliveryKey) return null;
  const key = fromBase64(args.deliveryKey);
  try {
    return await decryptJson<GrantPayload>(args.encryptedGrant, key, Context.Grant);
  } finally {
    wipe(key);
  }
}
