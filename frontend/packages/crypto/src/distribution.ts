/**
 * Chuẩn bị phần dành cho từng người nhận — chạy trên trình duyệt OWNER.
 *
 * Với mỗi người nhận: đóng gói (thư mở đầu + danh sách hạng mục kèm ItemKey) rồi NIÊM PHONG bằng khoá công khai
 * X25519 của đúng người đó (crypto_box_seal). Server giữ bản niêm phong nhưng không đọc được, và chỉ trao cho người
 * nhận khi hồ sơ được bàn giao (hết ân hạn mà owner không check-in). Người nhận mở bằng khoá riêng nằm trên thiết bị
 * của họ, được bọc bằng passphrase của chính họ.
 *
 * Ma trận phân bổ cũng được mã hoá bằng VaultKey để owner chỉnh lại về sau.
 *
 * Đầu ra khớp DistributeKeysInput của API.
 */
import { toBase64, utf8 } from './encoding';
import { seal } from './primitives';
import { encryptAllocation } from './vault';
import type { Allocation, GrantPayload, VaultItemKind } from './types';

/** Người nhận thông tin đã hoàn tất lời mời (có khoá công khai). */
export type RecipientInfo = { id: string; publicKey: string };
export type AllocatableItem = { id: string; itemKey: Uint8Array; title: string; kind: VaultItemKind };

export type DistributionPayload = {
  encryptedAllocation: string;
  grants: { trusteeId: string; sealedPayload: string; itemCount: number }[];
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
    grants.push({ trusteeId: r.id, sealedPayload: await seal(utf8.encode(JSON.stringify(payload)), r.publicKey), itemCount: assigned.length });
  }

  return { encryptedAllocation: await encryptAllocation(vaultKey, allocation), grants };
}
