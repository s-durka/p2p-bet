use anchor_lang::prelude::*;
use crate::state::Bet;
use crate::constants::BET_SEED;
use crate::error::ErrorCode;

#[derive(Accounts)]
#[instruction(_bet_index: u64, voted_winner: u8)]
pub struct ResolverVote<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [BET_SEED.as_bytes(), &_bet_index.to_le_bytes()],
        bump,
        constraint = bet.accepted == true,
        constraint = bet.voting_state.resolved == false,
        constraint = voted_winner <= 1,
    )]
    pub bet: Account<'info, Bet>,
}

pub fn handler(
    ctx: Context<ResolverVote>,
    _bet_index: u64,
    voted_winner: u8, // 0 = creator, 1 = challenger
) -> Result<()> {
    let signer = ctx.accounts.signer.key();
    let bet = &mut ctx.accounts.bet;

    // Find the resolver index
    let resolver_index = bet
        .resolver_group
        .iter()
        .position(|r| *r == signer)
        .ok_or(ErrorCode::NotAuthorizedToVote)?;

    if bet.voting_state.resolver_votes[resolver_index].is_some() {
        return Err(ErrorCode::AlreadyVoted.into());
    }

    bet.voting_state.resolver_votes[resolver_index] = Some(voted_winner);

    let mut count_creator = 0;
    let mut count_challenger = 0;
    let mut total_votes = 0;

    for vote in &bet.voting_state.resolver_votes {
        if let Some(v) = vote {
            total_votes += 1;
            if *v == 0 {
                count_creator += 1;
            } else if *v == 1 {
                count_challenger += 1;
            }
        }
    }

    // Use 2/3 majority quorum
    let total_resolvers = bet.resolver_group.len();
    let quorum = (2 * total_resolvers + 2) / 3; // equivalent to ceiling of 2/3

    if total_votes >= quorum {
        let majority = if count_creator >= quorum {
            Some(0)
        } else if count_challenger >= quorum {
            Some(1)
        } else {
            None
        };

        if let Some(winner) = majority {
            bet.voting_state.winner = Some(winner);
            bet.voting_state.resolved = true;
        }
    }

    Ok(())
}
