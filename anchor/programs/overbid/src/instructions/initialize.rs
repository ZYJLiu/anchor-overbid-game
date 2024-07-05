use crate::Collection;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + 4 + 32 + 8,
        seeds = [b"auth"],
        bump,
    )]
    pub authority: Account<'info, Collection>,
    pub system_program: Program<'info, System>,
}

pub fn process_initialize(ctx: Context<Initialize>) -> Result<()> {
    let account = &mut ctx.accounts.authority;
    account.bump = ctx.bumps.authority;

    msg!("Mints length: {:?}", account.items.len());
    Ok(())
}
