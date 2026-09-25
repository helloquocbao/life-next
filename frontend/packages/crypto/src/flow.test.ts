/**
 * Kiểm thử đầu-cuối toàn bộ luồng mật mã (không cần server):
 * owner tạo két → thêm hạng mục → phân mảnh 2-of-3 → 2 trustee đồng thuận → trustee thứ 3 mở hộp nhận.
 */
import { describe, expect, it } from 'vitest';
import {
  buildDistribution,
  createKeyring,
  createVault,
  decryptItem,
  decryptItemWithKey,
  encryptItem,
  isValidRecoveryPhrase,
  openInbox,
  prepareConsentDeliveries,
  recoverVault,
  unlockKeyring,
  unlockVault,
  type VaultItemData,
} from './index';

const FAST = { opsLimit: 1, memLimit: 8 * 1024 * 1024 }; // tham số nhẹ cho test

const item = (title: string): VaultItemData => ({
  v: 1,
  kind: 'bank',
  title,
  fields: [{ key: 'account', label: 'Số tài khoản', value: '0123456789', secret: true }],
  updatedAt: new Date().toISOString(),
});

describe('luồng zero-knowledge đầu-cuối', () => {
  it('tạo, mở khoá và khôi phục két', async () => {
    const { payload, vaultKey, recoveryPhrase } = await createVault('mật khẩu rất dài', FAST);
    expect(isValidRecoveryPhrase(recoveryPhrase)).toBe(true);
    expect(recoveryPhrase.split(' ')).toHaveLength(12);

    expect(await unlockVault(payload, 'mật khẩu rất dài')).toEqual(vaultKey);
    await expect(unlockVault(payload, 'sai')).rejects.toThrow();

    const { vaultKey: recovered } = await recoverVault(payload, recoveryPhrase, 'mới', FAST);
    expect(recovered).toEqual(vaultKey);
  });

  it('2-of-3: chỉ trustee được phân mới đọc được đúng hạng mục của mình', async () => {
    const { vaultKey } = await createVault('pw', FAST);
    const a = await encryptItem(vaultKey, item('Vietcombank'));
    const b = await encryptItem(vaultKey, item('Techcombank'));
    expect((await decryptItem(vaultKey, a)).data.title).toBe('Vietcombank');

    const [t1, t2, t3] = await Promise.all(['p1', 'p2', 'p3'].map((p) => createKeyring(p, FAST)));
    const ids = ['t1', 't2', 't3'];
    const dist = await buildDistribution({
      vaultKey,
      ownerName: 'An',
      threshold: 2,
      recipients: [t1, t2, t3].map((t, i) => ({ id: ids[i], publicKey: t.payload.publicKey, isKeyHolder: true })),
      items: [
        { id: 'A', itemKey: a.itemKey, title: 'Vietcombank', kind: 'bank' },
        { id: 'B', itemKey: b.itemKey, title: 'Techcombank', kind: 'bank' },
      ],
      allocation: { v: 1, assignments: { t3: ['A'], t1: ['B'] }, letters: { t3: 'Gửi con' } },
    });
    expect(dist.shares).toHaveLength(3);
    expect(dist.grants.map((g) => g.trusteeId).sort()).toEqual(['t1', 't3']);

    // t1 và t2 đồng thuận: mở mảnh của mình, niêm phong lại cho các trustee khác
    const keys = await Promise.all([t1, t2, t3].map((t, i) => unlockKeyring(t.payload, `p${i + 1}`)));
    const share = (id: string) => dist.shares.find((s) => s.trusteeId === id)!.sealedShare;
    const d1 = await prepareConsentDeliveries(share('t1'), keys[0], [{ trusteeId: 't3', publicKey: t3.payload.publicKey }]);
    const d2 = await prepareConsentDeliveries(share('t2'), keys[1], [{ trusteeId: 't3', publicKey: t3.payload.publicKey }]);

    // t3 mở hộp nhận với 2 mảnh được chuyển (không cần mảnh của chính mình)
    const grant = await openInbox({
      keys: keys[2],
      sealedShares: [d1[0].sealedShare, d2[0].sealedShare],
      threshold: 2,
      sealedGrant: dist.grants.find((g) => g.trusteeId === 't3')!.sealedPayload,
    });
    expect(grant!.letter).toBe('Gửi con');
    expect(grant!.items.map((i) => i.id)).toEqual(['A']);
    expect((await decryptItemWithKey(a.ciphertext, grant!.items[0].key)).title).toBe('Vietcombank');

    // Chỉ 1 mảnh thì không mở được
    await expect(
      openInbox({ keys: keys[2], sealedShares: [d1[0].sealedShare], threshold: 2, sealedGrant: dist.grants[0].sealedPayload }),
    ).rejects.toThrow();

    // t3 không mở được grant của t1 dù có đủ mảnh
    await expect(
      openInbox({
        keys: keys[2],
        sealedShares: [d1[0].sealedShare, d2[0].sealedShare],
        threshold: 2,
        sealedGrant: dist.grants.find((g) => g.trusteeId === 't1')!.sealedPayload,
      }),
    ).rejects.toThrow();
  });
});
