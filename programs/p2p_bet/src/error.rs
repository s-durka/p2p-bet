use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Custom error message")]
    CustomError,
    #[msg("Bet is already resolved")]
    BetAlreadyResolved,
    #[msg("Account accepting bet is not the expected challenger")]
    WrongChallenger,
    #[msg("Bet has already been accepted")]
    BetAlreadyAccepted,
}
