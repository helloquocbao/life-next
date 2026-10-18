import { assertSafeConfig, type ChainConfig, type Cluster } from '@deathnote/chain';

const env = import.meta.env;

/** "url|khoá công khai,url|khoá công khai,…" — khoá công khai của từng nút được ghim sẵn khi build. */
function parseNodes(raw: string) {
  return raw.split(',').filter(Boolean).map((item) => {
    const [url, publicKey] = item.split('|');
    if (!url || !publicKey) throw new Error('VITE_RELEASE_NODES sai định dạng (url|publicKey,…)');
    return { url: url.trim(), publicKey: publicKey.trim() };
  });
}

/** Cấu hình lấy từ biến môi trường build (xem .env.example). Mặc định: localnet dev. */
export const config: ChainConfig = {
  cluster: (env.VITE_CLUSTER ?? 'localnet') as Cluster,
  rpcUrl: env.VITE_RPC_URL ?? 'http://127.0.0.1:8899',
  programId: env.VITE_PROGRAM_ID ?? 'CWUPdsmDTAGh22Q7MGNHg5YhUzk5WNkcxQ7FN2etfQNS',
  treasury: env.VITE_TREASURY ?? '4hHj5bsNyVrXwJfwDPjdyoD2dJVxLHWNVTV7ULe8kCTa',
  demoTime: (env.VITE_DEMO_TIME ?? 'true') === 'true',
  monthlyPriceLamports: Number(env.VITE_MONTHLY_PRICE_LAMPORTS ?? 20_000_000),
  storage: {
    kind: 'kubo',
    apiUrl: env.VITE_IPFS_API ?? 'http://127.0.0.1:5011',
    gatewayUrl: env.VITE_IPFS_GATEWAY ?? 'http://127.0.0.1:8088',
  },
  heirKey:
    (env.VITE_HEIR_KEY ?? 'dev-local') === 'threshold'
      ? { kind: 'threshold', threshold: Number(env.VITE_RELEASE_THRESHOLD ?? 2), nodes: parseNodes(env.VITE_RELEASE_NODES ?? '') }
      : { kind: 'dev-local' },
};

assertSafeConfig(config);
