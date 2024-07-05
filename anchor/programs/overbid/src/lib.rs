use anchor_lang::prelude::*;

use instructions::*;
mod instructions;
use state::*;
mod state;

declare_id!("8y7t2oh2JyvYUBGKYKt5i1EGXtwEG17xPHJ3RmP9jHqi");

#[program]
pub mod overbid {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        process_initialize(ctx)
    }

    pub fn mint(ctx: Context<MintToken>, uri: String) -> Result<()> {
        process_mint(ctx, uri)
    }

    pub fn bid(ctx: Context<Bid>, amount: u64) -> Result<()> {
        process_bid(ctx, amount)
    }

    pub fn redeem(ctx: Context<Redeem>) -> Result<()> {
        process_redeem(ctx)
    }
}
