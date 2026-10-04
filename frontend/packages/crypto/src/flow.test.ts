/**
 * Kiểm thử đầu-cuối toàn bộ luồng mật mã (không cần server):
 * owner tạo két → thêm hạng mục → niêm phong phần dành cho từng người nhận → người nhận mở đúng phần của mình.
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
  openGrant,
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

  it('mỗi người nhận chỉ mở được đúng phần được niêm phong cho mình', async () => {
    const { vaultKey } = await createVault('pw', FAST);
    const a = await encryptItem(vaultKey, item('Vietcombank'));
    const b = await encryptItem(vaultKey, item('Techcombank'));
    expect((await decryptItem(vaultKey, a)).data.title).toBe('Vietcombank');

    const [t1, t3] = await Promise.all(['p1', 'p3'].map((p) => createKeyring(p, FAST)));
    const dist = await buildDistribution({
      vaultKey,
      ownerName: 'An',
      recipients: [
        { id: 't1', publicKey: t1.payload.publicKey },
        { id: 't3', publicKey: t3.payload.publicKey },
      ],
      items: [
        { id: 'A', itemKey: a.itemKey, title: 'Vietcombank', kind: 'bank' },
        { id: 'B', itemKey: b.itemKey, title: 'Techcombank', kind: 'bank' },
      ],
      allocation: { v: 1, assignments: { t3: ['A'], t1: ['B'] }, letters: { t3: 'Gửi con' } },
    });
    expect(dist.grants.map((g) => g.trusteeId).sort()).toEqual(['t1', 't3']);
    const grantOf = (id: string) => dist.grants.find((g) => g.trusteeId === id)!.sealedPayload;

    // Server không đọc được: payload là ciphertext, không chứa chữ rõ.
    expect(grantOf('t3')).not.toContain('Gửi con');
    expect(atob(grantOf('t3'))).not.toContain('Vietcombank');

    // t3 mở phần của mình bằng khoá riêng (mở khoá bằng passphrase trên thiết bị của họ).
    const keys3 = await unlockKeyring(t3.payload, 'p3');
    const grant = await openGrant({ keys: keys3, sealedGrant: grantOf('t3') });
    expect(grant!.letter).toBe('Gửi con');
    expect(grant!.items.map((i) => i.id)).toEqual(['A']);
    expect((await decryptItemWithKey(a.ciphertext, grant!.items[0].key)).title).toBe('Vietcombank');

    // Sai passphrase thì không mở được khoá riêng.
    await expect(unlockKeyring(t3.payload, 'sai')).rejects.toThrow();

    // t3 không mở được phần của t1.
    await expect(openGrant({ keys: keys3, sealedGrant: grantOf('t1') })).rejects.toThrow();

    // Không có phần nào được phân → null.
    expect(await openGrant({ keys: keys3, sealedGrant: null })).toBeNull();
  });

  it('bỏ qua người nhận không được phân gì và không có thư', async () => {
    const { vaultKey } = await createVault('pw', FAST);
    const t = await createKeyring('p', FAST);
    const dist = await buildDistribution({
      vaultKey, ownerName: 'An', recipients: [{ id: 't', publicKey: t.payload.publicKey }], items: [],
      allocation: { v: 1, assignments: {}, letters: {} },
    });
    expect(dist.grants).toHaveLength(0);
  });
});
