use anchor_lang::prelude::*;

/// Hồ sơ của A (người dùng). Thanh toán = check-in: `paid_until` là mốc A đã trả tới.
#[account]
#[derive(InitSpace)]
pub struct Profile {
    pub owner: Pubkey,
    /// A đã trả tới thời điểm này. Quá `paid_until + OVERDUE_SECONDS` mà chưa trả → bàn giao.
    pub paid_until: i64,
    /// `paid_until` tại lúc phần nợ đã được một người nhận trả — mỗi lần A ngừng trả chỉ thu nợ một lần.
    pub debt_settled_for: i64,
    pub next_vault_id: u32,
    pub vault_count: u32,
    /// Ai đặt cọc rent (A hoặc ví tài trợ phí của hệ thống) → hoàn lại khi đóng.
    pub rent_payer: Pubkey,
    pub created_at: i64,
    pub bump: u8,
}

/// Một két, giao cho đúng một người nhận (B). Nội dung đã mã hoá nằm ngoài chuỗi tại `uri`.
/// Thứ tự trường cố định ở đầu (owner, heir, claimed) để Lit đọc được theo offset.
#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub owner: Pubkey,
    pub heir: Pubkey,
    pub claimed: bool,
    pub id: u32,
    pub claimed_at: i64,
    pub updated_at: i64,
    /// SHA-256 của gói đã mã hoá — người nhận kiểm tra dữ liệu tải về không bị tráo.
    pub content_hash: [u8; 32],
    pub rent_payer: Pubkey,
    pub bump: u8,
    #[max_len(128)]
    pub uri: String,
}

impl Profile {
    /// Thời điểm két của A được bàn giao nếu A không trả tiếp.
    pub fn release_at(&self) -> i64 {
        self.paid_until.saturating_add(crate::OVERDUE_SECONDS)
    }
}
