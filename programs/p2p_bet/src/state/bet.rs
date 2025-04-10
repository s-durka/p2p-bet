use anchor_lang::prelude::*;

#[account]
pub struct Bet {
    pub creator: Pubkey,
    pub challenger: Pubkey,
    pub resolver_group: Vec<Pubkey>,

    pub creator_stake: u64,
    pub challenger_stake: u64,

    pub accepted: bool,
    pub resolved: bool,
    pub winning_side: Option<u8>,    // 0 = creator, 1 = challenger
    
    pub deadline: i64,               // UNIX timestamp
}