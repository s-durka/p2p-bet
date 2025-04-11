use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct VotingState {
    pub creator_vote: Option<u8>,         // 0 = creator wins, 1 = challenger wins
    pub challenger_vote: Option<u8>,      // 0 = creator wins, 1 = challenger wins 
    pub resolver_votes: Vec<Option<u8>>,  // Matches resolver_group length
    pub resolved: bool,
    pub winner: Option<u8>,         // 0 = creator wins, 1 = challenger wins
}

impl VotingState {
    pub fn size(resolver_count: usize) -> usize {
        // Fixed-size:
        // Option<u8> = 1 (tag) + 1 (value)
        // bool = 1
        // Vec<T> = 4 (length prefix) + len * size(T)

        1 + 1 + // creator_vote
        1 + 1 + // challenger_vote
        1 +     // resolved
        1 + 1 + // winning_side
        4 + (2 * resolver_count) // resolver_votes: Vec<Option<u8>>
    }
}