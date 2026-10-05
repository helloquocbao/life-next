/**
 * Chuẩn bị phần dành cho từng người nhận — chạy trên trình duyệt OWNER.
 *
 * Người nhận mặc định KHÔNG biết gì và không có khoá cá nhân từ trước. Với mỗi người nhận, owner:
 *   1. Sinh một "khoá giao hàng" ngẫu nhiên riêng cho người đó.
 *   2. Đóng gói (thư mở đầu + danh sách hạng mục kèm ItemKey) rồi mã hoá bằng khoá giao hàng (AEAD) → `sealedPayload`.
 *   3. Gửi lên server cả `sealedPayload` lẫn khoá giao hàng. Server giữ khoá giao hàng (mã hoá bằng khoá chủ cấu hình trên
 *      máy chủ) và CHỈ trao cho đúng người nhận sau khi hồ sơ được bàn giao (hết ân hạn mà owner không check-in).
 *
 * Đánh đổi: khác với niêm phong bằng khoá công khai của người nhận, máy chủ (khi có cả CSDL lẫn khoá chủ) về kỹ thuật
 * giải mã được phần đã phân cho người nhận — đổi lại người nhận không cần tạo tài khoản/khoá trước, đúng yêu cầu "mặc định
 * không biết gì". Toàn bộ phần còn lại của két (không được phân) vẫn chỉ owner mở được.
 *
 * Ma trận phân bổ cũng được mã hoá bằng VaultKey để owner chỉnh lại về sau. Đầu ra khớp DistributeKeysInput của API.
 */
import { toBase64, wipe } from './encoding';
import { Context, encryptJson, generateKey } from './primitives';
import { encryptAllocation } from './vault';
import type { Allocation, GrantPayload, VaultItemKind } from './types';

export type RecipientInfo = { id: string };
export type AllocatableItem = { id: string; itemKey: Uint8Array; title: string; kind: VaultItemKind };

export type DistributionPayload = {
  encryptedAllocation: string;
  grants: { trusteeId: string; sealedPayload: string; deliveryKey: string; itemCount: number }[];
};

export async function buildDistribution(args: {
  vaultKey: Uint8Array;
  ownerName: string;
  recipients: RecipientInfo[];
  items: AllocatableItem[];
  allocation: Allocation;
}): Promise<DistributionPayload> {
  const { vaultKey, ownerName, recipients, items, allocation } = args;

  const byId = new Map(items.map((it) => [it.id, it]));
  const grants: DistributionPayload['grants'] = [];
  for (const r of recipients) {
    const assigned = (allocation.assignments[r.id] ?? []).map((id) => byId.get(id)).filter((x): x is AllocatableItem => !!x);
    const letter = allocation.letters[r.id]?.trim() || undefined;
    if (assigned.length === 0 && !letter) continue;
    const payload: GrantPayload = {
      v: 1,
      ownerName,
      generatedAt: new Date().toISOString(),
      letter,
      items: assigned.map((it) => ({ id: it.id, key: toBase64(it.itemKey), title: it.title, kind: it.kind })),
    };
    const deliveryKey = await generateKey();
    try {
      grants.push({
        trusteeId: r.id,
        sealedPayload: await encryptJson(payload, deliveryKey, Context.Grant),
        deliveryKey: toBase64(deliveryKey),
        itemCount: assigned.length,
      });
    } finally {
      wipe(deliveryKey);
    }
  }

  return { encryptedAllocation: await encryptAllocation(vaultKey, allocation), grants };
}
