use crate::{Collection, Items};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::rent::{
    DEFAULT_EXEMPTION_THRESHOLD, DEFAULT_LAMPORTS_PER_BYTE_YEAR,
};
use anchor_lang::system_program::{transfer, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::{freeze_account, mint_to, FreezeAccount, MintTo};
use anchor_spl::token_interface::{
    token_metadata_initialize, token_metadata_update_field, Mint, Token2022, TokenAccount,
    TokenMetadataInitialize, TokenMetadataUpdateField,
};
use spl_token_metadata_interface::state::{Field, TokenMetadata};
use spl_type_length_value::variable_len_pack::VariableLenPack;

#[derive(Accounts)]
pub struct MintToken<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"auth"],
        bump = authority.bump,
        realloc = 8 + 4 + ((32 + 8) * (authority.items.len() + 1)) + 1,
        realloc::payer = payer,
        realloc::zero = false,
    )]
    pub authority: Account<'info, Collection>,
    #[account(
        init,
        payer = payer,
        mint::decimals = 0,
        mint::authority = authority,
        mint::freeze_authority = authority,
        extensions::permanent_delegate::delegate = authority,
        extensions::metadata_pointer::authority = authority,
        extensions::metadata_pointer::metadata_address = mint_account,
    )]
    pub mint_account: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = payer,
        associated_token::mint = mint_account,
        associated_token::authority = payer,
        associated_token::token_program = token_program
    )]
    pub token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// Currently, any random uri can be provided. Maybe add server keypair signer
pub fn process_mint(ctx: Context<MintToken>, uri: String) -> Result<()> {
    let name = "OPOS".to_string();
    let symbol = "OPOS".to_string();

    // Define token metadata
    let token_metadata = TokenMetadata {
        name: name.clone(),
        symbol: symbol.clone(),
        uri: uri.clone(),
        ..Default::default()
    };

    // Add 4 extra bytes for size of MetadataExtension (2 bytes for type, 2 bytes for length)
    // Add 100 bytes worth of rent for custom fields, calculating exact is more complicated
    // custom field value is stored as string, so each char approx. an extra byte
    let data_len = (100) + 4 + token_metadata.get_packed_len()?;

    // Calculate lamports required for the additional metadata
    let lamports =
        data_len as u64 * DEFAULT_LAMPORTS_PER_BYTE_YEAR * DEFAULT_EXEMPTION_THRESHOLD as u64;

    // Transfer additional lamports to mint account
    transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.mint_account.to_account_info(),
            },
        ),
        lamports,
    )?;

    // Initialize token metadata
    let signer_seeds: &[&[&[u8]]] = &[&[b"auth", &[ctx.accounts.authority.bump]]];
    token_metadata_initialize(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TokenMetadataInitialize {
                token_program_id: ctx.accounts.token_program.to_account_info(),
                mint: ctx.accounts.mint_account.to_account_info(),
                metadata: ctx.accounts.mint_account.to_account_info(),
                mint_authority: ctx.accounts.authority.to_account_info(),
                update_authority: ctx.accounts.authority.to_account_info(),
            },
        )
        .with_signer(signer_seeds),
        name,
        symbol,
        uri,
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
        Field::Key("overbid".to_string()),
        0.to_string(),
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

    // Mint token
    mint_to(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint_account.to_account_info(),
                to: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        )
        .with_signer(signer_seeds),
        1,
    )?;

    freeze_account(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            FreezeAccount {
                account: ctx.accounts.token_account.to_account_info().clone(),
                mint: ctx.accounts.mint_account.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        )
        .with_signer(signer_seeds),
    )?;

    ctx.accounts.authority.items.push(Items {
        mint: ctx.accounts.mint_account.key(),
        points: 0,
    });

    msg!("Mints length: {:?}", ctx.accounts.authority.items.len());
    // msg!("Mints length: {:?}", ctx.accounts.authority.items);

    Ok(())
}
