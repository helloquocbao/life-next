import { assertSafeConfig, type ChainConfig, type Cluster } from '@deathnote/chain';

const env = import.meta.env;

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
    (env.VITE_HEIR_KEY ?? 'dev-local') === 'lit'
      ? { kind: 'lit', network: (env.VITE_LIT_NETWORK ?? 'naga-dev') as 'naga-dev' }
      : { kind: 'dev-local' },
};

assertSafeConfig(config);
