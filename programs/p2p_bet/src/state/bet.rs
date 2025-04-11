use anchor_lang::prelude::*;
use crate::state::voting_state::VotingState;

#[account]
pub struct Bet {
    pub creator: Pubkey,
    pub challenger: Pubkey,
    pub resolver_group: Vec<Pubkey>,

    pub creator_stake: u64,
    pub challenger_stake: u64, // 8 bytes

    pub accepted: bool,
    pub resolved: bool,
    
    pub deadline: i64,               // UNIX timestamp

    pub voting_state: VotingState,
}

impl Bet {
    pub fn size(resolver_count: usize) -> usize {
        8 + // discriminator
        32 + // creator
        32 + // challenger
        8 +  // creator_stake
        8 +  // challenger_stake
        1 +  // accepted
        8 +  // deadline
        4 + (32 * resolver_count) + // resolver_group: Vec<Pubkey>
        VotingState::size(resolver_count) // embedded voting state
    }
}