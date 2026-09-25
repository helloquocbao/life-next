/**
 * Chia bí mật Shamir (Shamir's Secret Sharing) — nền tảng của cơ chế "m trong n người đồng ý".
 *
 * ReleaseKey (32 byte) được chia thành n mảnh; bất kỳ m mảnh nào cũng ghép lại được khoá,
 * còn m−1 mảnh thì KHÔNG tiết lộ một bit thông tin nào về khoá (bảo mật theo lý thuyết thông tin).
 *
 * Dùng thư viện `shamir-secret-sharing` của Privy — đã được Cure53 và Zellic kiểm toán độc lập.
 */
import { combine, split } from 'shamir-secret-sharing';

export async function splitSecret(secret: Uint8Array, shares: number, threshold: number): Promise<Uint8Array[]> {
  if (threshold < 1 || threshold > shares) throw new Error('Ngưỡng m-of-n không hợp lệ');
  // Trường hợp đặc biệt 1-of-1: thư viện yêu cầu n ≥ 2, nên "mảnh" chính là bí mật.
  // Backend chỉ cho phép khi owner có đúng 1 người giữ khoá (và vẫn còn thẩm định + chờ cuối).
  if (shares === 1) return [secret.slice()];
  return split(secret, shares, threshold);
}

export async function combineShares(shares: Uint8Array[], threshold: number): Promise<Uint8Array> {
  if (shares.length < threshold) throw new Error(`Cần ít nhất ${threshold} mảnh khoá, mới có ${shares.length}.`);
  if (threshold === 1 && shares.length >= 1) {
    // 1-of-1: mảnh chính là bí mật; nếu nhiều hơn 1 mảnh thì dùng thuật toán ghép bình thường.
    if (shares[0].length === 32) return shares[0].slice();
  }
  return combine(shares);
}
