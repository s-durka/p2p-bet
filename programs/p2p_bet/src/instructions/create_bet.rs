use anchor_lang::prelude::*;
use crate::state::{
    bet::Bet,
    voting_state::VotingState
};
use crate::constants::{BET_SEED, LOCKUP_SEED};
use anchor_lang::system_program::{
    transfer,
    Transfer
};

#[derive(Accounts)]
#[instruction(
    _bet_index: u64,
    resolver_group: Vec<Pubkey>,
)]
pub struct CreateBet<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    /// CHECK: This is just a raw SOL holder, not storing data
    #[account(
        mut,
        seeds = [
            LOCKUP_SEED.as_bytes(),
            &_bet_index.to_le_bytes()
        ],
        bump
    )]
    pub lockup: AccountInfo<'info>,

    #[account(
        init,
        payer = creator,
        space = Bet::size(resolver_group.len()), // TODO: Calculate the actual size of Bet
        seeds = [
            BET_SEED.as_bytes(),
            &_bet_index.to_le_bytes()
        ],
        bump
    )]
    pub bet: Account<'info, Bet>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateBet>,
    _bet_index: u64,
    resolver_group: Vec<Pubkey>,
    creator_stake: u64,
    expected_challenger_stake: u64,
    challenger: Pubkey,
    deadline: i64,

) -> Result<()> {
    let bet = &mut ctx.accounts.bet;
    let creator = &ctx.accounts.creator;
    let lockup = &ctx.accounts.lockup;
    let system_program = &ctx.accounts.system_program;

    bet.creator = creator.key();
    bet.challenger = challenger;
    bet.resolver_group = resolver_group;
    bet.creator_stake = creator_stake;
    bet.challenger_stake = expected_challenger_stake; // expected challenger stake
    bet.resolved = false;
    bet.deadline = deadline;
    bet.accepted = false;

    bet.voting = VotingState {
        resolver_votes: vec![None; bet.resolver_group.len()],
        ..Default::default()
    };

    // Transfer SOL into lockup PDA (escrow)
    transfer(
        CpiContext::new(
            system_program.to_account_info(),
            Transfer {
                from: creator.to_account_info(),
                to: lockup.to_account_info(),
            },
        ),
        creator_stake,
    )?;

    Ok(())
}