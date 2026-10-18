use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::{constants::*, error::ErrorCode, state::Profile};

#[event]
pub struct Paid {
    pub owner: Pubkey,
    pub months: u16,
    pub paid_until: i64,
}

#[event]
pub struct ProfileClosed {
    pub owner: Pubkey,
}

#[derive(Accounts)]
pub struct InitProfile<'info> {
    /// Người trả rent: A, hoặc ví tài trợ phí của hệ thống.
    #[account(mut)]
    pub payer: Signer<'info>,
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + Profile::INIT_SPACE,
        seeds = [PROFILE_SEED, owner.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, Profile>,
    pub system_program: Program<'info, System>,
}

pub fn handle_init_profile(ctx: Context<InitProfile>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let p = &mut ctx.accounts.profile;
    p.owner = ctx.accounts.owner.key();
    // Chưa trả kỳ nào: coi như đã trả tới lúc tạo — không nợ gì, đồng hồ bắt đầu chạy từ đây.
    p.paid_until = now;
    p.debt_settled_for = 0;
    p.next_vault_id = 0;
    p.vault_count = 0;
    p.rent_payer = ctx.accounts.payer.key();
    p.created_at = now;
    p.bump = ctx.bumps.profile;
    Ok(())
}

#[derive(Accounts)]
pub struct Pay<'info> {
    /// Ai trả tiền (thường là A). Có thể khác `owner`, nhưng `owner` vẫn phải ký: thanh toán = A xác nhận còn sống.
    #[account(mut)]
    pub payer: Signer<'info>,
    pub owner: Signer<'info>,
    #[account(mut, seeds = [PROFILE_SEED, owner.key().as_ref()], bump = profile.bump, has_one = owner)]
    pub profile: Account<'info, Profile>,
    /// CHECK: chỉ nhận lamports; địa chỉ cố định bằng hằng số.
    #[account(mut, address = TREASURY @ ErrorCode::WrongTreasury)]
    pub treasury: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

/// Thanh toán `months` tháng = check-in. Trả nối tiếp từ mốc đã trả (phần quá hạn cũng phải trả),
/// phải che được tới hiện tại, và không vượt quá 90 ngày tính từ hiện tại.
/// Trả được cả khi đã quá hạn bàn giao: két nào người nhận CHƯA lấy sẽ không còn mở được nữa.
pub fn handle_pay(ctx: Context<Pay>, months: u16) -> Result<()> {
    require!(months >= 1, ErrorCode::InvalidMonths);
    let now = Clock::get()?.unix_timestamp;
    let p = &mut ctx.accounts.profile;

    let new_paid_until = p
        .paid_until
        .checked_add(MONTH_SECONDS.checked_mul(months as i64).ok_or(ErrorCode::Overflow)?)
        .ok_or(ErrorCode::Overflow)?;
    require!(new_paid_until > now, ErrorCode::StillOverdue);
    require!(new_paid_until <= now + MAX_PREPAY_SECONDS, ErrorCode::PrepayLimitExceeded);

    let amount = MONTHLY_PRICE_LAMPORTS.checked_mul(months as u64).ok_or(ErrorCode::Overflow)?;
    transfer(
        CpiContext::new(
            ctx.accounts.system_program.key(),
            Transfer { from: ctx.accounts.payer.to_account_info(), to: ctx.accounts.treasury.to_account_info() },
        ),
        amount,
    )?;

    p.paid_until = new_paid_until;
    emit!(Paid { owner: p.owner, months, paid_until: new_paid_until });
    Ok(())
}

#[derive(Accounts)]
pub struct CloseProfile<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [PROFILE_SEED, owner.key().as_ref()],
        bump = profile.bump,
        has_one = owner,
        has_one = rent_payer,
        close = rent_payer
    )]
    pub profile: Account<'info, Profile>,
    /// CHECK: chỉ nhận lại tiền cọc rent; khớp với `profile.rent_payer`.
    #[account(mut)]
    pub rent_payer: UncheckedAccount<'info>,
}

/// A rời hệ thống: phải xoá hết két trước, rồi đóng hồ sơ để hoàn cọc rent.
pub fn handle_close_profile(ctx: Context<CloseProfile>) -> Result<()> {
    require!(ctx.accounts.profile.vault_count == 0, ErrorCode::VaultsRemaining);
    emit!(ProfileClosed { owner: ctx.accounts.owner.key() });
    Ok(())
}
