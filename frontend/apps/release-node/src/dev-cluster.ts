/**
 * Môi trường dev: 3 nút mở khoá (cổng 7101–7103) trên localnet, mỗi nút một khoá riêng trong keys/.
 * Thật sự triển khai: mỗi nút do một bên khác nhau vận hành, trên máy khác nhau.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { generateKeys, loadKeys } from './keys.ts';
import { startNode } from './server.ts';

mkdirSync('keys', { recursive: true });
for (let i = 1; i <= 3; i++) {
  const file = `keys/node-${i}.json`;
  if (!existsSync(file)) await generateKeys(file);
  const keys = await loadKeys(file);
  startNode({
    port: 7100 + i,
    keys,
    rpcUrl: process.env.RPC_URL ?? 'http://127.0.0.1:8899',
    programId: process.env.PROGRAM_ID ?? 'CWUPdsmDTAGh22Q7MGNHg5YhUzk5WNkcxQ7FN2etfQNS',
  });
  console.log(`node-${i} :${7100 + i} pubkey=${Buffer.from(keys.publicKey).toString('base64')}`);
}
