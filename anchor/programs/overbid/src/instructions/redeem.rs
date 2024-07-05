use crate::{Collection, OverbidError};
use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022::extension::BaseStateWithExtensions;
use anchor_spl::token_2022::spl_token_2022::{
    extension::StateWithExtensions, state::Mint as MintState,
};
use anchor_spl::token_interface::Mint;
use spl_token_metadata_interface::state::TokenMetadata;

#[derive(Accounts)]
pub struct Redeem<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"auth"],
        bump = authority.bump,
    )]
    pub authority: Account<'info, Collection>,
    #[account(mut)]
    pub mint_account: InterfaceAccount<'info, Mint>,
}

pub fn process_redeem(ctx: Context<Redeem>) -> Result<()> {
    let mint = ctx.accounts.mint_account.to_account_info();
    let mint_data = mint.data.borrow();
    let mint_with_extension = StateWithExtensions::<MintState>::unpack(&mint_data)?;
    let metadata = mint_with_extension.get_variable_len_extension::<TokenMetadata>()?;
    drop(mint_data);

    let owner = metadata
        .additional_metadata
        .iter()
        .find(|(key, _)| key == "owner")
        .map(|(_, value)| value)
        .ok_or(ProgramError::InvalidAccountData)?;

    if owner != &ctx.accounts.owner.key().to_string() {
        return err!(OverbidError::WrongOwner);
    }

    let item_index = ctx
        .accounts
        .authority
        .items
        .iter()
        .position(|item| item.mint == *mint.key)
        .ok_or(ProgramError::InvalidAccountData)?;

    // lamports redeemable for current mint
    let points = ctx.accounts.authority.items[item_index].points;
    msg!("{:?}", ctx.accounts.authority.items[item_index]);

    ctx.accounts.authority.sub_lamports(points)?;
    ctx.accounts.owner.add_lamports(points)?;

    ctx.accounts.authority.items[item_index].points = 0;
    msg!("{:?}", ctx.accounts.authority.items[item_index]);
    msg!("Redeemed {} points for mint {}", points, mint.key);

    Ok(())
}
