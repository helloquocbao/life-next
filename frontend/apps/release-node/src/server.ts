/**
 * Nút mở khoá LifeNext — HTTP, không cơ sở dữ liệu, không ghi log nội dung yêu cầu.
 *   node src/server.ts --port 7101 --key keys/node-1.json --rpc http://127.0.0.1:8899 --program <PROGRAM_ID>
 */
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { parseArgs } from 'node:util';
import { Connection, PublicKey } from '@solana/web3.js';
import { loadKeys } from './keys.ts';
import { handleRelease, ReleaseError, type NodeKeys, type ReleaseRequest } from './release.ts';

const MAX_BODY = 16 * 1024;

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) throw new ReleaseError(413, 'Yêu cầu quá lớn');
    chunks.push(c as Buffer);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new ReleaseError(400, 'JSON không hợp lệ'); }
}

export function startNode(opts: { port: number; keys: NodeKeys; rpcUrl: string; programId: string; allowOrigin?: string }): Server {
  const connection = new Connection(opts.rpcUrl, 'confirmed');
  const publicKey = Buffer.from(opts.keys.publicKey).toString('base64');
  const server = createServer(async (req, res) => {
    res.setHeader('access-control-allow-origin', opts.allowOrigin ?? '*');
    res.setHeader('access-control-allow-headers', 'content-type');
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    try {
      if (req.method === 'OPTIONS') return void res.writeHead(204).end();
      if (req.method === 'GET' && req.url === '/info') return send(200, { publicKey, programId: opts.programId });
      if (req.method === 'POST' && req.url === '/release') {
        const body = (await readJson(req)) as ReleaseRequest;
        const sealedShare = await handleRelease(body, {
          programId: opts.programId,
          keys: opts.keys,
          now: Math.floor(Date.now() / 1000),
          getVault: async (address) => {
            const acc = await connection.getAccountInfo(new PublicKey(address), 'confirmed');
            return acc ? { owner: acc.owner.toBase58(), data: new Uint8Array(acc.data) } : null;
          },
        });
        return send(200, { sealedShare });
      }
      send(404, { error: 'Không có' });
    } catch (e) {
      if (e instanceof ReleaseError) send(e.status, { error: e.message });
      else send(500, { error: 'Lỗi nút mở khoá' });
    }
  });
  server.listen(opts.port);
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({
    options: {
      port: { type: 'string', default: '7101' },
      key: { type: 'string' },
      rpc: { type: 'string', default: 'http://127.0.0.1:8899' },
      program: { type: 'string', default: 'CWUPdsmDTAGh22Q7MGNHg5YhUzk5WNkcxQ7FN2etfQNS' },
      origin: { type: 'string' },
    },
  });
  const keys = await loadKeys(values.key);
  startNode({ port: Number(values.port), keys, rpcUrl: values.rpc!, programId: values.program!, allowOrigin: values.origin });
  console.log(`release-node :${values.port} pubkey=${Buffer.from(keys.publicKey).toString('base64')}`);
}
