/**
 * Kiểm thử đầu-cuối toàn bộ luồng mật mã (không cần server):
 * owner tạo két → thêm hạng mục → mã hoá phần dành cho từng người nhận bằng khoá giao hàng riêng → người nhận mở đúng phần của mình.
 */
import { describe, expect, it } from 'vitest';
import {
  buildDistribution,
  createVault,
  decryptItem,
  decryptItemWithKey,
  encryptItem,
  isValidRecoveryPhrase,
  openGrant,
  recoverVault,
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

  it('mỗi người nhận có khoá giao hàng riêng, chỉ mở được đúng phần của mình', async () => {
    const { vaultKey } = await createVault('pw', FAST);
    const a = await encryptItem(vaultKey, item('Vietcombank'));
    const b = await encryptItem(vaultKey, item('Techcombank'));
    expect((await decryptItem(vaultKey, a)).data.title).toBe('Vietcombank');

    const dist = await buildDistribution({
      vaultKey,
      ownerName: 'An',
      recipients: [{ id: 't1' }, { id: 't3' }],
      items: [
        { id: 'A', itemKey: a.itemKey, title: 'Vietcombank', kind: 'bank' },
        { id: 'B', itemKey: b.itemKey, title: 'Techcombank', kind: 'bank' },
      ],
      allocation: { v: 1, assignments: { t3: ['A'], t1: ['B'] }, letters: { t3: 'Gửi con' } },
    });
    expect(dist.grants.map((g) => g.trusteeId).sort()).toEqual(['t1', 't3']);
    const grantOf = (id: string) => dist.grants.find((g) => g.trusteeId === id)!;
    expect(grantOf('t1').deliveryKey).not.toEqual(grantOf('t3').deliveryKey);

    // Server không đọc được nếu không có khoá giao hàng: payload là ciphertext, không chứa chữ rõ.
    expect(grantOf('t3').sealedPayload).not.toContain('Gửi con');
    expect(atob(grantOf('t3').sealedPayload)).not.toContain('Vietcombank');

    // t3 nhận khoá giao hàng của mình (sau bàn giao) → mở đúng phần của mình.
    const grant = await openGrant({ encryptedGrant: grantOf('t3').sealedPayload, deliveryKey: grantOf('t3').deliveryKey });
    expect(grant!.letter).toBe('Gửi con');
    expect(grant!.items.map((i) => i.id)).toEqual(['A']);
    expect((await decryptItemWithKey(a.ciphertext, grant!.items[0].key)).title).toBe('Vietcombank');

    // Khoá giao hàng của t1 không mở được phần của t3 (mỗi người một khoá).
    await expect(openGrant({ encryptedGrant: grantOf('t3').sealedPayload, deliveryKey: grantOf('t1').deliveryKey })).rejects.toThrow();

    // Không có phần nào được phân / chưa có khoá → null.
    expect(await openGrant({ encryptedGrant: null, deliveryKey: grantOf('t3').deliveryKey })).toBeNull();
    expect(await openGrant({ encryptedGrant: grantOf('t3').sealedPayload, deliveryKey: null })).toBeNull();
  });

  it('bỏ qua người nhận không được phân gì và không có thư', async () => {
    const { vaultKey } = await createVault('pw', FAST);
    const dist = await buildDistribution({
      vaultKey, ownerName: 'An', recipients: [{ id: 't' }], items: [],
      allocation: { v: 1, assignments: {}, letters: {} },
    });
    expect(dist.grants).toHaveLength(0);
  });
});
