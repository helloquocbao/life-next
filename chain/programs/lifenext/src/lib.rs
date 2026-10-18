//! LifeNext — két số bàn giao tự động trên Solana.
//!
//! Luật (không có quản trị, không nâng cấp, không ai can thiệp được):
//! - A (người dùng) thanh toán theo tháng; MỖI LẦN THANH TOÁN LÀ MỘT LẦN CHECK-IN. Trả trước tối đa 90 ngày.
//! - A quá hạn thanh toán 30 ngày → két được bàn giao: người nhận (B) gọi `claim`, trả phần A còn nợ.
//! - Mỗi két giao cho đúng một người nhận. Nội dung két mã hoá ngoài chuỗi; khoá cho B do Lit Protocol giữ và
//!   chỉ trả khi két đã `claimed` và người xin đúng là B.
//! - A trả tiền trước khi B lấy → két chưa lấy không mở được nữa. A xoá két/hồ sơ → hoàn cọc rent.
pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("CWUPdsmDTAGh22Q7MGNHg5YhUzk5WNkcxQ7FN2etfQNS");

#[program]
pub mod lifenext {
    use super::*;

    pub fn init_profile(ctx: Context<InitProfile>) -> Result<()> {
        instructions::profile::handle_init_profile(ctx)
    }

    pub fn pay(ctx: Context<Pay>, months: u16) -> Result<()> {
        instructions::profile::handle_pay(ctx, months)
    }

    pub fn close_profile(ctx: Context<CloseProfile>) -> Result<()> {
        instructions::profile::handle_close_profile(ctx)
    }

    pub fn create_vault(ctx: Context<CreateVault>, heir: Pubkey, uri: String, content_hash: [u8; 32]) -> Result<()> {
        instructions::vault::handle_create_vault(ctx, heir, uri, content_hash)
    }

    pub fn update_vault(ctx: Context<UpdateVault>, heir: Pubkey, uri: String, content_hash: [u8; 32]) -> Result<()> {
        instructions::vault::handle_update_vault(ctx, heir, uri, content_hash)
    }

    pub fn delete_vault(ctx: Context<DeleteVault>) -> Result<()> {
        instructions::vault::handle_delete_vault(ctx)
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        instructions::claim::handle_claim(ctx)
    }
}
