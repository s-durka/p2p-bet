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
}
