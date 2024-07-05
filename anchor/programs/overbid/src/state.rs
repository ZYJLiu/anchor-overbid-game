use anchor_lang::prelude::*;

#[account]
pub struct Collection {
    pub items: Vec<Items>,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Copy)]
pub struct Items {
    pub mint: Pubkey,
    pub points: u64,
}
