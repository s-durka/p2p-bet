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

    #[msg("Bet has not been accepted")]
    BetNotAccepted,
    #[msg("Invalid vote")]
    InvalidVote,
    #[msg("Account not authorized to vote")]
    NotAuthorizedToVote,

    #[msg("This account already voted")]
    AlreadyVoted,
    #[msg("Bet not resolved")]
    BetNotResolved,

    #[msg("Invalid winner account")]
    InvalidWinnerAccount,
    #[msg("Invalid creator account")]
    InvalidCreatorAccount,
}
