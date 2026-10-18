use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::{constants::*, error::ErrorCode, state::{Profile, Vault}};

#[event]
pub struct VaultClaimed {
    pub owner: Pubkey,
    pub vault: Pubkey,
    pub heir: Pubkey,
    pub debt_paid: u64,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub heir: Signer<'info>,
    #[account(mut, seeds = [PROFILE_SEED, vault.owner.as_ref()], bump = profile.bump)]
    pub profile: Account<'info, Profile>,
    #[account(
        mut,
        seeds = [VAULT_SEED, vault.owner.as_ref(), &vault.id.to_le_bytes()],
        bump = vault.bump,
        has_one = heir @ ErrorCode::NotHeir
    )]
    pub vault: Account<'info, Vault>,
    /// CHECK: chỉ nhận lamports; địa chỉ cố định bằng hằng số.
    #[account(mut, address = TREASURY @ ErrorCode::WrongTreasury)]
    pub treasury: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

/// Người nhận lấy két sau khi A quá hạn 30 ngày. Trả phần A còn nợ (đúng kỳ đã quá hạn) — mỗi lần A ngừng trả
/// chỉ thu một lần, dù A có nhiều két cho nhiều người nhận. Đánh dấu `claimed` → Lit mới trả khoá cho người nhận.
pub fn handle_claim(ctx: Context<Claim>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let profile = &mut ctx.accounts.profile;
    let vault = &mut ctx.accounts.vault;
    require!(!vault.claimed, ErrorCode::AlreadyClaimed);
    require!(now >= profile.release_at(), ErrorCode::NotReleasedYet);

    let mut debt = 0;
    if profile.debt_settled_for != profile.paid_until {
        debt = MONTHLY_PRICE_LAMPORTS;
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                Transfer { from: ctx.accounts.heir.to_account_info(), to: ctx.accounts.treasury.to_account_info() },
            ),
            debt,
        )?;
        profile.debt_settled_for = profile.paid_until;
    }

    vault.claimed = true;
    vault.claimed_at = now;
    emit!(VaultClaimed { owner: vault.owner, vault: vault.key(), heir: vault.heir, debt_paid: debt });
    Ok(())
}
