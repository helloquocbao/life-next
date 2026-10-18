use anchor_lang::prelude::*;

/// Một "ngày" của chương trình. Bản `demo-time` (chỉ dùng trên devnet để trình diễn) nén 1 ngày = 4 giây,
/// tức 1 tháng ≈ 2 phút. Bản phát hành thật KHÔNG bật feature này.
#[cfg(not(feature = "demo-time"))]
pub const DAY_SECONDS: i64 = 24 * 60 * 60;
#[cfg(feature = "demo-time")]
pub const DAY_SECONDS: i64 = 4;

/// Một "tháng" thuê bao = 30 ngày. Mỗi lần A thanh toán là một lần check-in.
pub const MONTH_SECONDS: i64 = 30 * DAY_SECONDS;

/// Trả trước tối đa 90 ngày tính từ hiện tại (dùng khi biết trước sẽ vắng: phẫu thuật, đi xa).
pub const MAX_PREPAY_SECONDS: i64 = 90 * DAY_SECONDS;

/// Quá hạn thanh toán 30 ngày → két được bàn giao cho người nhận.
pub const OVERDUE_SECONDS: i64 = 30 * DAY_SECONDS;

/// Phí thuê bao một tháng (lamports). Cố định khi phát hành — chương trình không có quản trị nên không đổi được.
pub const MONTHLY_PRICE_LAMPORTS: u64 = 20_000_000; // 0.02 SOL

/// Ví nhận phí thuê bao của bên vận hành. Cố định khi phát hành.
pub const TREASURY: Pubkey = pubkey!("4hHj5bsNyVrXwJfwDPjdyoD2dJVxLHWNVTV7ULe8kCTa");

/// Đường dẫn tới gói đã mã hoá (vd. "ipfs://<cid>").
pub const MAX_URI_LEN: usize = 128;

#[constant]
pub const PROFILE_SEED: &[u8] = b"profile";
#[constant]
pub const VAULT_SEED: &[u8] = b"vault";
