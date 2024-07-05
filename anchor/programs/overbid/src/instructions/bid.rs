use crate::Collection;
use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::spl_token_2022::extension::BaseStateWithExtensions;
use anchor_spl::token_2022::spl_token_2022::{
    extension::StateWithExtensions, state::Mint as MintState,
};
use anchor_spl::token_2022::{
    freeze_account, thaw_account, transfer_checked, FreezeAccount, ThawAccount, TransferChecked,
};
use anchor_spl::token_interface::{
    token_metadata_update_field, Mint, Token2022, TokenAccount, TokenMetadataUpdateField,
};
use spl_token_metadata_interface::state::{Field, TokenMetadata};

#[derive(Accounts)]
pub struct Bid<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    pub owner: SystemAccount<'info>,
    #[account(
        mut,
        seeds = [b"auth"],
        bump = authority.bump,
    )]
    pub authority: Account<'info, Collection>,
    #[account(mut)]
    pub mint_account: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint_account,
        associated_token::authority = owner,
        associated_token::token_program = token_program
    )]
    pub source_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint_account,
        associated_token::authority = payer,
        associated_token::token_program = token_program
    )]
    pub destination_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn process_bid(ctx: Context<Bid>, amount: u64) -> Result<()> {
    let mint = ctx.accounts.mint_account.to_account_info();
    let mint_data = mint.data.borrow();
    let mint_with_extension = StateWithExtensions::<MintState>::unpack(&mint_data)?;
    let metadata = mint_with_extension.get_variable_len_extension::<TokenMetadata>()?;
    drop(mint_data);

    let overbid_value = metadata
        .additional_metadata
        .iter()
        .find(|(key, _)| key == "overbid")
        .map(|(_, value)| value)
        .ok_or(error!(OverbidError::MissingOverbidField))?
        .parse::<u64>()
        .map_err(|_| error!(OverbidError::InvalidOverbidValue))?;

    // must bid at least 0.01 SOL above
    let minimum_overbid = 10_000_000;
    let minimum_bid_required = overbid_value + minimum_overbid;

    // Check if the new bid is higher than the current value to overbid
    msg!("Current value to overbid: {:?}", overbid_value);
    msg!("Minimum bid required: {:?}", minimum_bid_required);
    require!(amount >= minimum_bid_required, OverbidError::BidTooLow);

    let signer_seeds: &[&[&[u8]]] = &[&[b"auth", &[ctx.accounts.authority.bump]]];
    token_metadata_update_field(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TokenMetadataUpdateField {
                token_program_id: ctx.accounts.token_program.to_account_info(),
                metadata: ctx.accounts.mint_account.to_account_info(),
                update_authority: ctx.accounts.authority.to_account_info(),
            },
        )
        .with_signer(signer_seeds),
        Field::Key("overbid".to_string()),
        amount.to_string(),
    )?;

    token_metadata_update_field(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TokenMetadataUpdateField {
                token_program_id: ctx.accounts.token_program.to_account_info(),
                metadata: ctx.accounts.mint_account.to_account_info(),
                update_authority: ctx.accounts.authority.to_account_info(),
            },
        )
        .with_signer(signer_seeds),
        Field::Key("owner".to_string()),
        ctx.accounts.payer.key().to_string(),
    )?;

    thaw_account(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            ThawAccount {
                account: ctx.accounts.source_account.to_account_info().clone(),
                mint: ctx.accounts.mint_account.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        )
        .with_signer(signer_seeds),
    )?;

    if ctx.accounts.destination_account.is_frozen() {
        thaw_account(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                ThawAccount {
                    account: ctx.accounts.destination_account.to_account_info().clone(),
                    mint: ctx.accounts.mint_account.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
        )?;
    }

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.source_account.to_account_info().clone(),
                mint: ctx.accounts.mint_account.to_account_info().clone(),
                to: ctx.accounts.destination_account.to_account_info().clone(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        )
        .with_signer(signer_seeds),
        1,
        ctx.accounts.mint_account.decimals,
    )?;

    let diff = amount - overbid_value;
    let items = &mut ctx.accounts.authority.items;
    let item_count = items.len() as u64;
    let points_per_item = diff / item_count;
    let remainder = diff % item_count;

    for item in items.iter_mut() {
        item.points += points_per_item;
    }

    transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.authority.to_account_info(),
            },
        ),
        diff - remainder,
    )?;

    transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.owner.to_account_info(),
            },
        ),
        overbid_value + remainder,
    )?;

    freeze_account(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            FreezeAccount {
                account: ctx.accounts.source_account.to_account_info().clone(),
                mint: ctx.accounts.mint_account.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        )
        .with_signer(signer_seeds),
    )?;

    freeze_account(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            FreezeAccount {
                account: ctx.accounts.destination_account.to_account_info().clone(),
                mint: ctx.accounts.mint_account.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        )
        .with_signer(signer_seeds),
    )?;

    Ok(())
}

#[error_code]
pub enum OverbidError {
    #[msg("Overbid field is missing in token metadata")]
    MissingOverbidField,
    #[msg("Invalid overbid value in token metadata")]
    InvalidOverbidValue,
    #[msg("New bid must be higher than the current value to overbid")]
    BidTooLow,
    #[msg("Wrong Owner")]
    WrongOwner,
}
