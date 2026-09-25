/**
 * Phân mảnh khoá & phân bổ người nhận — chạy trên trình duyệt OWNER.
 *
 * 1. Sinh ReleaseKey mới (mỗi lần phân mảnh là một khoá mới ⇒ mảnh cũ tự vô hiệu).
 * 2. Chia ReleaseKey bằng Shamir thành n mảnh, niêm phong mỗi mảnh cho đúng một người giữ khoá.
 * 3. Với mỗi người nhận: đóng gói (thư mở đầu + danh sách hạng mục + ItemKey) → mã hoá bằng ReleaseKey
 *    → niêm phong bằng khoá công khai của họ. = "khoá hai lớp".
 * 4. Bọc ReleaseKey và ma trận phân bổ bằng VaultKey để owner chỉnh sửa lại về sau.
 *
 * Đầu ra khớp DistributeKeysInput của API.
 */
import { toBase64, utf8, wipe } from './encoding';
import { Context, encrypt, encryptJson, generateKey, seal } from './primitives';
import { splitSecret } from './shamir';
import { encryptAllocation } from './vault';
import type { Allocation, GrantPayload, VaultItemKind } from './types';

export type RecipientInfo = { id: string; publicKey: string; isKeyHolder: boolean };
export type AllocatableItem = { id: string; itemKey: Uint8Array; title: string; kind: VaultItemKind };

export type DistributionPayload = {
  threshold: number;
  wrappedReleaseKey: string;
  encryptedAllocation: string;
  shares: { trusteeId: string; sealedShare: string }[];
  grants: { trusteeId: string; sealedPayload: string; itemCount: number }[];
};

export async function buildDistribution(args: {
  vaultKey: Uint8Array;
  ownerName: string;
  threshold: number;
  recipients: RecipientInfo[];
  items: AllocatableItem[];
  allocation: Allocation;
}): Promise<DistributionPayload> {
  const { vaultKey, ownerName, threshold, recipients, items, allocation } = args;
  const keyHolders = recipients.filter((r) => r.isKeyHolder);
  if (keyHolders.length === 0) throw new Error('Cần ít nhất một người giữ khoá đã xác nhận.');

  const releaseKey = await generateKey();
  try {
    // (2) Shamir m-of-n
    const rawShares = await splitSecret(releaseKey, keyHolders.length, threshold);
    const shares = await Promise.all(
      keyHolders.map(async (r, i) => ({ trusteeId: r.id, sealedShare: await seal(rawShares[i], r.publicKey) })),
    );
    rawShares.forEach(wipe);

    // (3) Grant khoá hai lớp cho từng người nhận
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
      const inner = await encryptJson(payload, releaseKey, Context.Grant);
      grants.push({ trusteeId: r.id, sealedPayload: await seal(utf8.encode(inner), r.publicKey), itemCount: assigned.length });
    }

    return {
      threshold,
      wrappedReleaseKey: await encrypt(releaseKey, vaultKey, Context.ReleaseKey),
      encryptedAllocation: await encryptAllocation(vaultKey, allocation),
      shares,
      grants,
    };
  } finally {
    wipe(releaseKey);
  }
}
