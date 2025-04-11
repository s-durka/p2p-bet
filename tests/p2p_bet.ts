import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { P2pBet } from "../target/types/p2p_bet";
import { SystemProgram, LAMPORTS_PER_SOL, PublicKey, Keypair } from "@solana/web3.js";
import BN from "bn.js";

describe("P2P Bet", () => {
  anchor.setProvider(anchor.AnchorProvider.local());

  const program = anchor.workspace.P2pBet as Program<P2pBet>;

  const creator = program.provider.publicKey;
  const challenger = Keypair.generate();
  const resolver1 = Keypair.generate();
  const resolver2 = Keypair.generate();

  const betIndex = new BN(0);
  const creatorStake = new BN(1 * LAMPORTS_PER_SOL);
  const challengerStake = new BN(1.3 * LAMPORTS_PER_SOL);
  const deadline = new BN(Math.floor(Date.now() / 1000) + 86400);

  const [bet] = PublicKey.findProgramAddressSync(
    [Buffer.from("bet"), betIndex.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  const [lockup] = PublicKey.findProgramAddressSync(
    [Buffer.from("lockup"), betIndex.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  it("Creates bet", async () => {
    await program.methods
      .createBet(
        betIndex,
        [resolver1.publicKey, resolver2.publicKey],
        creatorStake,
        challengerStake,
        challenger.publicKey,
        deadline
      )
      .accounts({
        creator,
        lockup,
        bet,
        systemProgram: SystemProgram.programId
      })
      .rpc();

    const lockupBalance = await program.provider.connection.getBalance(lockup);
    expect(lockupBalance).to.eq(creatorStake.toNumber());
    console.log("lockup balance after creating bet = ", lockupBalance);

    const betAccount = await program.account.bet.fetch(bet);

    expect(betAccount.creator.toString()).to.eq(creator.toString());
    expect(betAccount.challenger.toString()).to.eq(challenger.publicKey.toString());
    expect(betAccount.creatorStake.toNumber()).to.eq(creatorStake.toNumber());
    expect(betAccount.challengerStake.toNumber()).to.eq(challengerStake.toNumber());
    expect(betAccount.accepted).to.be.false;
    expect(betAccount.votingState.resolved).to.be.false;
    expect(betAccount.deadline.toNumber()).to.eq(deadline.toNumber());

    expect(betAccount.resolverGroup.length).to.eq(2);
    expect(betAccount.resolverGroup[0].toString()).to.eq(resolver1.publicKey.toString());
    expect(betAccount.resolverGroup[1].toString()).to.eq(resolver2.publicKey.toString());
  });

  it("Challenger accepts the bet and transfers stake", async () => {
    const connection = program.provider.connection;

    // Airdrop SOL to challenger to cover their stake
    const sig = await connection.requestAirdrop(challenger.publicKey, challengerStake.toNumber());

    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
      {
        signature: sig,
        ...latestBlockhash,
      }, 
      "confirmed"
    );

    const challengerBalance = await connection.getBalance(challenger.publicKey);
    expect(challengerBalance).to.be.eq(challengerStake.toNumber());
    

    const lockupBalanceBefore = await connection.getBalance(lockup);
    expect(lockupBalanceBefore).to.eq(creatorStake.toNumber());

    await program.methods
      .acceptBet(betIndex)
      .accounts({
        challenger: challenger.publicKey,
        lockup,
        bet,
        systemProgram: SystemProgram.programId
      })
      .signers([challenger])
      .rpc();

    const lockupBalanceAfter = await connection.getBalance(lockup);
    const expectedTotal = creatorStake.add(challengerStake).toNumber();
    expect(lockupBalanceAfter).to.eq(expectedTotal);
    console.log("lockup balance after accepting bet = ", lockupBalanceAfter);

    const betAccount = await program.account.bet.fetch(bet);
    expect(betAccount.accepted).to.eq(true);
  });

  it("Players vote and resolve the bet", async () => {
    const connection = program.provider.connection;

    // Creator votes first: says creator wins (0)
    await program.methods
      .castPlayerVote(betIndex, 0)
      .accounts({
        signer: creator,
        bet,
      })
      .rpc();

    let betAccount = await program.account.bet.fetch(bet);
    expect(betAccount.votingState.creatorVote).to.eq(0);
    expect(betAccount.votingState.challengerVote).to.be.null;
    expect(betAccount.votingState.resolved).to.be.false;

    // Challenger votes the same: says creator wins (0)
    await program.methods
      .castPlayerVote(betIndex, 0)
      .accounts({
        signer: challenger.publicKey,
        bet,
      })
      .signers([challenger])
      .rpc();

    // Fetch updated state
    betAccount = await program.account.bet.fetch(bet);

    expect(betAccount.votingState.creatorVote).to.eq(0);
    expect(betAccount.votingState.challengerVote).to.eq(0);
    expect(betAccount.votingState.resolved).to.eq(true);
    expect(betAccount.votingState.winner).to.eq(0); // 0 = creator
  });

});
