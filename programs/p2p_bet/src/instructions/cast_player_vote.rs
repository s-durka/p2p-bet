use anchor_lang::prelude::*;
use crate::state::Bet;
use crate::constants::BET_SEED;
use crate::error::ErrorCode;

#[derive(Accounts)]
#[instruction(_bet_index: u64)]
pub struct CastPlayerVote<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [BET_SEED.as_bytes(), &_bet_index.to_le_bytes()],
        bump
    )]
    pub bet: Account<'info, Bet>,
}

pub fn handler(
    ctx: Context<CastPlayerVote>,
    _bet_index: u64,
    voted_winner: u8, // 0 = creator wins, 1 = challenger wins
) -> Result<()> {
    let signer = ctx.accounts.signer.key();
    
    let bet = &mut ctx.accounts.bet;
    let creator = bet.creator;
    let challenger = bet.challenger;
    
    require!(bet.accepted, ErrorCode::BetNotAccepted);
    require!(voted_winner <= 1, ErrorCode::InvalidVote);
    
    let voting_state = &mut bet.voting_state;

    require!(!voting_state.resolved, ErrorCode::BetAlreadyResolved);

    // Record vote
    if signer == creator {
        voting_state.creator_vote = Some(voted_winner);
    } else if signer == challenger {
        voting_state.challenger_vote = Some(voted_winner);
    } else {
        return Err(ErrorCode::NotAuthorizedToVote.into());
    }

    // Check if both players have voted AND agree
    if let (Some(creator_vote), Some(challenger_vote)) =
        (voting_state.creator_vote, voting_state.challenger_vote)
    {
        if creator_vote == challenger_vote {
            voting_state.winner = Some(creator_vote);
            voting_state.resolved = true;
        }
    }

    Ok(())
}