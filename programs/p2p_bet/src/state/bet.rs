use anchor_lang::prelude::*;

#[account]
pub struct Bet {
    pub creator: Pubkey,
    pub challenger: Pubkey,
    pub resolver_group: Vec<Pubkey>,

    pub creator_stake: u64,
    pub challenger_stake: u64, // 8 bytes

    pub accepted: bool,
    pub resolved: bool,
    pub winning_side: Option<u8>,    // 0 = creator, 1 = challenger
    
    pub deadline: i64,               // UNIX timestamp
}

impl Bet {
    pub const MIN_SIZE: usize = 32 // creator
        + 32                       // challenger
        + 4 + 4                    // resolver_group (4 bytes for length + 4 bytes padding)
        + 8                        // creator_stake
        + 8                        // challenger_stake
        + 1 + 7                    // accepted (1 byte + 7 bytes padding)
        + 1 + 7                    // resolved (1 byte + 7 bytes padding)
        + 2 + 6                    // winning_side (2 bytes + 6 bytes padding)
        + 8;                       // deadline
}