/**
 * Cấu hình một môi trường chạy (localnet / devnet / mainnet). Mọi hằng số thời gian PHẢI khớp với bản build
 * của chương trình on-chain (`demo-time` nén 1 ngày = 4 giây — chỉ dùng localnet/devnet để trình diễn).
 */
export type Cluster = 'localnet' | 'devnet' | 'mainnet';

export type ChainConfig = {
  cluster: Cluster;
  rpcUrl: string;
  programId: string;
  treasury: string;
  /** Khớp feature `demo-time` của chương trình. */
  demoTime: boolean;
  /** Phí thuê bao một tháng (lamports) — khớp `MONTHLY_PRICE_LAMPORTS`. */
  monthlyPriceLamports: number;
  storage: { kind: 'kubo'; apiUrl: string; gatewayUrl: string };
  /**
   * Ai giữ khoá két cho người nhận cho tới khi bàn giao:
   * - `threshold`: các nút mở khoá độc lập, cần `threshold` nút đồng ý (xem threshold.ts).
   * - `dev-local`: không ai giữ — chỉ được phép trên localnet.
   */
  heirKey: { kind: 'threshold'; threshold: number; nodes: { url: string; publicKey: string }[] } | { kind: 'dev-local' };
};

export const daySeconds = (c: Pick<ChainConfig, 'demoTime'>) => (c.demoTime ? 4 : 24 * 60 * 60);
export const monthSeconds = (c: Pick<ChainConfig, 'demoTime'>) => 30 * daySeconds(c);
export const overdueSeconds = (c: Pick<ChainConfig, 'demoTime'>) => 30 * daySeconds(c);
export const maxPrepaySeconds = (c: Pick<ChainConfig, 'demoTime'>) => 90 * daySeconds(c);

export function assertSafeConfig(c: ChainConfig) {
  if (c.heirKey.kind === 'dev-local' && c.cluster !== 'localnet')
    throw new Error('heirKey "dev-local" để khoá két ngay trong gói dữ liệu — chỉ dùng trên localnet.');
  if (c.demoTime && c.cluster === 'mainnet') throw new Error('Không chạy bản nén thời gian trên mainnet.');
}
