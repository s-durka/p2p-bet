use anchor_lang::prelude::*;
use crate::state::Bet;
use crate::constants::{BET_SEED, LOCKUP_SEED};
use anchor_lang::system_program::{
    transfer,
    Transfer
};
use crate::error::ErrorCode;

#[derive(Accounts)]
#[instruction(_bet_index: u64)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub winner: Signer<'info>,

    #[account(
        mut,
        seeds = [BET_SEED.as_bytes(), &_bet_index.to_le_bytes()],
        bump,
        close = creator,
    )]
    pub bet: Account<'info, Bet>,

    /// CHECK: Must match bet.creator
    #[account(mut)]
    pub creator: AccountInfo<'info>,

    /// CHECK: Vault holding the prize pool
    #[account(
        mut,
        seeds = [LOCKUP_SEED.as_bytes(), &_bet_index.to_le_bytes()],
        bump,
    )]
    pub lockup: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimWinnings>, _bet_index: u64) -> Result<()> {
    let bet = &ctx.accounts.bet;

    require!(bet.voting_state.resolved, ErrorCode::BetNotResolved);

    let winner = bet.voting_state.winner.ok_or(ErrorCode::BetNotResolved)?;

    let expected_winner = if winner == 0 {
        bet.creator
    } else {
        bet.challenger
    };

    require_keys_eq!(ctx.accounts.winner.key(), expected_winner, ErrorCode::InvalidWinnerAccount);
    require_keys_eq!(ctx.accounts.creator.key(), bet.creator, ErrorCode::InvalidCreatorAccount);

    let total = bet.creator_stake + bet.challenger_stake;

    let signer_seeds = &[
        LOCKUP_SEED.as_bytes(),
        &_bet_index.to_le_bytes(),
        &[ctx.bumps.lockup]
    ];

    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.lockup.to_account_info(),
                to: ctx.accounts.winner.to_account_info(),
            },
            &[signer_seeds],
        ),
        total,
    )?;

    Ok(())
}
