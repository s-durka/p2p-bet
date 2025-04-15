use anchor_lang::prelude::*;
use crate::state::Bet;
use crate::constants::{BET_SEED, LOCKUP_SEED};
use anchor_lang::system_program::{
    transfer,
    Transfer
};

#[derive(Accounts)]
#[instruction(_bet_index: u64)]
pub struct AcceptBet<'info> {
    #[account(mut)]
    pub challenger: Signer<'info>,

    #[account(
        mut,
        seeds = [
            LOCKUP_SEED.as_bytes(), 
            &_bet_index.to_le_bytes()
        ],
        bump
    )]
    /// CHECK: No data in lockup, just a SOL vault
    pub lockup: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [
            BET_SEED.as_bytes(), 
            &_bet_index.to_le_bytes()
        ],
        bump,
        constraint = bet.accepted == false,
        constraint = bet.voting_state.resolved == false,
        has_one = challenger,
    )]
    pub bet: Account<'info, Bet>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AcceptBet>, _bet_index: u64) -> Result<()> {
    let bet = &mut ctx.accounts.bet;
    let challenger = &ctx.accounts.challenger;
    let lockup = &ctx.accounts.lockup;
    let system_program = &ctx.accounts.system_program;

    bet.accepted = true;

    transfer(
        CpiContext::new(
            system_program.to_account_info(),
            Transfer {
                from: challenger.to_account_info(),
                to: lockup.to_account_info(),
            },
        ),
        bet.challenger_stake,
    )?;

    Ok(())
}