import { describe, expect, it } from 'vitest';
import { DevLocalCustodian } from './heirKey';
import { ownerStatus } from './status';
import { MemoryStore } from './storage';
import { deriveMasterKey, openAsHeir, openAsOwner, parsePackage, sealVault, verifyHash, type VaultContent } from './vaultCrypto';

const DEMO = { demoTime: true };
const MONTH = 30 * 4;

describe('ownerStatus (khớp luật on-chain)', () => {
  it('chia pha theo paid_until và 30 ngày quá hạn', () => {
    expect(ownerStatus(DEMO, 1000, 999).phase).toBe('active');
    expect(ownerStatus(DEMO, 1000, 1000).phase).toBe('overdue');
    expect(ownerStatus(DEMO, 1000, 1000 + MONTH - 1).phase).toBe('overdue');
    expect(ownerStatus(DEMO, 1000, 1000 + MONTH).phase).toBe('released');
  });

  it('số tháng trả được: tối đa 90 ngày tính từ hiện tại, tối thiểu đủ che phần quá hạn', () => {
    expect(ownerStatus(DEMO, 1000, 1000).maxMonthsNow).toBe(3);
    expect(ownerStatus(DEMO, 1000 + 3 * MONTH, 1000).maxMonthsNow).toBe(0);
    const late = ownerStatus(DEMO, 1000, 1000 + 2 * MONTH + 5);
    expect(late.minMonthsNow).toBe(3);
    expect(late.maxMonthsNow).toBe(5);
  });
});

describe('mã hoá két', () => {
  const content: VaultContent = {
    v: 1,
    title: 'Cho con',
    entries: [{ label: 'Email', value: 'a@example.com' }, { label: 'Mật khẩu', value: 's3cret', secret: true }],
    files: [{ name: 'so-do.pdf', type: 'application/pdf', size: 3, dataB64: 'AQID' }],
    updatedAt: '2026-10-18T00:00:00Z',
  };
  const ctx = { vault: 'Vault111', heir: 'Heir111', owner: 'Owner111', programId: 'Prog111' };

  it('A mở bằng khoá từ chữ ký; khoá khác không mở được; gói không chứa dữ liệu rõ', async () => {
    const master = await deriveMasterKey(new Uint8Array(64).fill(1));
    expect(await deriveMasterKey(new Uint8Array(64).fill(1))).toEqual(master);
    const custodian = new DevLocalCustodian(async () => true);
    const { bytes, hash } = await sealVault({ content, masterKey: master, ctx, custodian });

    const text = new TextDecoder().decode(bytes);
    expect(text).not.toContain('a@example.com');
    expect(text).not.toContain('s3cret');
    expect(text).not.toContain('so-do.pdf');

    const store = new MemoryStore();
    const uri = await store.put(bytes);
    const fetched = await store.get(uri);
    await verifyHash(fetched, hash);
    expect((await openAsOwner(parsePackage(fetched), master)).content).toEqual(content);

    const other = await deriveMasterKey(new Uint8Array(64).fill(2));
    await expect(openAsOwner(parsePackage(fetched), other)).rejects.toThrow();
  });

  it('B chỉ mở được khi két đã được bàn giao', async () => {
    const master = await deriveMasterKey(new Uint8Array(64).fill(3));
    let claimed = false;
    const custodian = new DevLocalCustodian(async () => claimed);
    const { bytes } = await sealVault({ content, masterKey: master, ctx, custodian });
    await expect(openAsHeir(parsePackage(bytes), custodian)).rejects.toThrow('chưa được bàn giao');
    claimed = true;
    expect(await openAsHeir(parsePackage(bytes), custodian)).toEqual(content);
  });

  it('phát hiện gói bị tráo', async () => {
    const master = await deriveMasterKey(new Uint8Array(64).fill(4));
    const { bytes, hash } = await sealVault({ content, masterKey: master, ctx, custodian: new DevLocalCustodian(async () => true) });
    const tampered = bytes.slice();
    tampered[tampered.length - 5] ^= 1;
    await expect(verifyHash(tampered, hash)).rejects.toThrow('không khớp');
  });

  it('chặn tệp vượt 5 MB', async () => {
    const big = { ...content, files: [{ name: 'x', type: 'x', size: 6 * 1024 * 1024, dataB64: '' }] };
    const master = await deriveMasterKey(new Uint8Array(64));
    await expect(sealVault({ content: big, masterKey: master, ctx, custodian: new DevLocalCustodian(async () => true) })).rejects.toThrow('5 MB');
  });
});
