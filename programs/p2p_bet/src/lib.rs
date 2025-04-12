pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("tCv5pdUvY7AZHYT1q2sQnoi4hk2BsC8CYSEzQkjiM5H");

#[program]
pub mod p2p_bet {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        initialize::handler(ctx)
    }

    pub fn create_bet(
                    ctx: Context<CreateBet>, 
                    bet_index: u64,
                    resolver_group: Vec<Pubkey>,
                    creator_stake: u64,
                    expected_challenger_stake: u64,
                    challenger: Pubkey,
                    deadline: i64,        
        ) -> Result<()> {
        create_bet::handler(
            ctx, 
            bet_index, 
            resolver_group, 
            creator_stake, 
            expected_challenger_stake, 
            challenger, 
            deadline)
    }

    pub fn accept_bet(ctx: Context<AcceptBet>, bet_index: u64) -> Result<()> {
        accept_bet::handler(ctx, bet_index)
    }

    pub fn cast_player_vote(
        ctx: Context<CastPlayerVote>,
        bet_index: u64,
        voted_winner: u8,
    ) -> Result<()> {
        cast_player_vote::handler(ctx, bet_index, voted_winner)
    }

    pub fn resolver_vote(
        ctx: Context<ResolverVote>,
        bet_index: u64,
        voted_winner: u8,
    ) -> Result<()> {
        resolver_vote::handler(ctx, bet_index, voted_winner)
    }

    pub fn claim_winnings(ctx: Context<ClaimWinnings>, bet_index: u64) -> Result<()> {
        claim_winnings::handler(ctx, bet_index)
    }
}