import { readFileSync, writeFileSync } from 'node:fs';
import sodium from 'libsodium-wrappers-sumo';
import type { NodeKeys } from './release.ts';

/** Khoá của nút: file JSON { publicKey, secretKey } (base64) hoặc biến môi trường NODE_SECRET_KEY (base64). */
export async function loadKeys(file?: string): Promise<NodeKeys> {
  await sodium.ready;
  const secretB64 = process.env.NODE_SECRET_KEY ?? (file ? (JSON.parse(readFileSync(file, 'utf8')) as { secretKey: string }).secretKey : undefined);
  if (!secretB64) throw new Error('Cần NODE_SECRET_KEY hoặc --key <file>');
  const secretKey = new Uint8Array(Buffer.from(secretB64, 'base64'));
  return { secretKey, publicKey: sodium.crypto_scalarmult_base(secretKey) };
}

export async function generateKeys(file: string) {
  await sodium.ready;
  const kp = sodium.crypto_box_keypair();
  const out = { publicKey: Buffer.from(kp.publicKey).toString('base64'), secretKey: Buffer.from(kp.privateKey).toString('base64') };
  writeFileSync(file, JSON.stringify(out, null, 2), { mode: 0o600 });
  return out.publicKey;
}
