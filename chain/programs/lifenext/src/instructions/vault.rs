use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, state::{Profile, Vault}};

#[event]
pub struct VaultSaved {
    pub owner: Pubkey,
    pub vault: Pubkey,
    pub heir: Pubkey,
}

#[event]
pub struct VaultDeleted {
    pub owner: Pubkey,
    pub vault: Pubkey,
}

#[derive(Accounts)]
pub struct CreateVault<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub owner: Signer<'info>,
    #[account(mut, seeds = [PROFILE_SEED, owner.key().as_ref()], bump = profile.bump, has_one = owner)]
    pub profile: Account<'info, Profile>,
    #[account(
        init,
        payer = payer,
        space = 8 + Vault::INIT_SPACE,
        seeds = [VAULT_SEED, owner.key().as_ref(), &profile.next_vault_id.to_le_bytes()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_vault(ctx: Context<CreateVault>, heir: Pubkey, uri: String, content_hash: [u8; 32]) -> Result<()> {
    require!(uri.len() <= MAX_URI_LEN, ErrorCode::UriTooLong);
    require_keys_neq!(heir, ctx.accounts.owner.key(), ErrorCode::HeirIsOwner);
    let now = Clock::get()?.unix_timestamp;
    let profile = &mut ctx.accounts.profile;
    let v = &mut ctx.accounts.vault;
    v.owner = ctx.accounts.owner.key();
    v.heir = heir;
    v.claimed = false;
    v.id = profile.next_vault_id;
    v.claimed_at = 0;
    v.updated_at = now;
    v.content_hash = content_hash;
    v.rent_payer = ctx.accounts.payer.key();
    v.bump = ctx.bumps.vault;
    v.uri = uri;

    profile.next_vault_id = profile.next_vault_id.checked_add(1).ok_or(ErrorCode::Overflow)?;
    profile.vault_count = profile.vault_count.checked_add(1).ok_or(ErrorCode::Overflow)?;
    emit!(VaultSaved { owner: v.owner, vault: v.key(), heir });
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateVault<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [VAULT_SEED, owner.key().as_ref(), &vault.id.to_le_bytes()],
        bump = vault.bump,
        has_one = owner
    )]
    pub vault: Account<'info, Vault>,
}

/// Sửa nội dung hoặc đổi người nhận (khi đổi người nhận, client phải mã hoá lại khoá cho người mới → `uri` mới).
pub fn handle_update_vault(ctx: Context<UpdateVault>, heir: Pubkey, uri: String, content_hash: [u8; 32]) -> Result<()> {
    require!(uri.len() <= MAX_URI_LEN, ErrorCode::UriTooLong);
    require_keys_neq!(heir, ctx.accounts.owner.key(), ErrorCode::HeirIsOwner);
    let v = &mut ctx.accounts.vault;
    require!(!v.claimed, ErrorCode::AlreadyClaimed);
    v.heir = heir;
    v.uri = uri;
    v.content_hash = content_hash;
    v.updated_at = Clock::get()?.unix_timestamp;
    emit!(VaultSaved { owner: v.owner, vault: v.key(), heir });
    Ok(())
}

#[derive(Accounts)]
pub struct DeleteVault<'info> {
    pub owner: Signer<'info>,
    #[account(mut, seeds = [PROFILE_SEED, owner.key().as_ref()], bump = profile.bump, has_one = owner)]
    pub profile: Account<'info, Profile>,
    #[account(
        mut,
        seeds = [VAULT_SEED, owner.key().as_ref(), &vault.id.to_le_bytes()],
        bump = vault.bump,
        has_one = owner,
        has_one = rent_payer,
        close = rent_payer
    )]
    pub vault: Account<'info, Vault>,
    /// CHECK: chỉ nhận lại tiền cọc rent; khớp với `vault.rent_payer`.
    #[account(mut)]
    pub rent_payer: UncheckedAccount<'info>,
}

/// Xoá két: đóng tài khoản (hoàn cọc) → điều kiện mở khoá trên Lit không bao giờ thoả nữa.
/// Client xoá thêm dữ liệu đã mã hoá ở nơi lưu trữ. Két đã được người nhận lấy thì không xoá được.
pub fn handle_delete_vault(ctx: Context<DeleteVault>) -> Result<()> {
    require!(!ctx.accounts.vault.claimed, ErrorCode::AlreadyClaimed);
    let profile = &mut ctx.accounts.profile;
    profile.vault_count = profile.vault_count.checked_sub(1).ok_or(ErrorCode::Overflow)?;
    emit!(VaultDeleted { owner: profile.owner, vault: ctx.accounts.vault.key() });
    Ok(())
}
