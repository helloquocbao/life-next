// @solana/web3.js và Anchor cần Buffer của Node trong trình duyệt. Phải import TRƯỚC mọi module khác.
import { Buffer } from 'buffer';

(globalThis as unknown as { Buffer: typeof Buffer }).Buffer ??= Buffer;
