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

  const newBetIndex = new BN(0);
  const creatorStake = new BN(1 * LAMPORTS_PER_SOL);
  const challengerStake = new BN(1.3 * LAMPORTS_PER_SOL);
  const deadline = new BN(Math.floor(Date.now() / 1000) + 86400);

  const [bet] = PublicKey.findProgramAddressSync(
    [Buffer.from("bet"), newBetIndex.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  const [newLockup] = PublicKey.findProgramAddressSync(
    [Buffer.from("lockup"), newBetIndex.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  it("Creates bet", async () => {
    await program.methods
      .createBet(
        newBetIndex,
        [resolver1.publicKey, resolver2.publicKey],
        creatorStake,
        challengerStake,
        challenger.publicKey,
        deadline
      )
      .accounts({
        creator,
        lockup: newLockup,
        bet,
        systemProgram: SystemProgram.programId
      })
      .rpc();

    const lockupBalance = await program.provider.connection.getBalance(newLockup);
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
    

    const lockupBalanceBefore = await connection.getBalance(newLockup);
    expect(lockupBalanceBefore).to.eq(creatorStake.toNumber());

    await program.methods
      .acceptBet(newBetIndex)
      .accounts({
        challenger: challenger.publicKey,
        lockup: newLockup,
        bet,
        systemProgram: SystemProgram.programId
      })
      .signers([challenger])
      .rpc();

    const lockupBalanceAfter = await connection.getBalance(newLockup);
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
      .castPlayerVote(newBetIndex, 0)
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
      .castPlayerVote(newBetIndex, 0)
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

  {
    const newBetIndex = new BN(2);

    const [newBet] = PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), newBetIndex.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
  
    const [newLockup] = PublicKey.findProgramAddressSync(
      [Buffer.from("lockup"), newBetIndex.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    
    it("Resolvers vote and resolve the bet with 2/3 majority", async () => {
      const connection = program.provider.connection;
    
      // Create 3 resolvers and a new bet index
      const r1 = resolver1;
      const r2 = resolver2;
      const r3 = Keypair.generate();
    

    
      // Airdrop to challenger + resolvers
      for (const kp of [challenger, r3]) {
        const sig = await connection.requestAirdrop(kp.publicKey, 2* LAMPORTS_PER_SOL);
        const blockhash = await connection.getLatestBlockhash();
        await connection.confirmTransaction({ signature: sig, ...blockhash }, "confirmed");
      }
    
      // Create bet with 3 resolvers
      await program.methods
        .createBet(
          newBetIndex,
          [r1.publicKey, r2.publicKey, r3.publicKey],
          creatorStake,
          challengerStake,
          challenger.publicKey,
          deadline
        )
        .accounts({
          creator,
          lockup: newLockup,
          bet: newBet,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    
      // Challenger accepts the bet
      await program.methods
        .acceptBet(newBetIndex)
        .accounts({
          challenger: challenger.publicKey,
          lockup: newLockup,
          bet: newBet,
          systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();
    
      // First resolver votes for challenger (1)
      await program.methods
        .resolverVote(newBetIndex, 1)
        .accounts({
          signer: r1.publicKey,
          bet: newBet,
        })
        .signers([r1])
        .rpc();
    
      // Second resolver votes for challenger (1)
      await program.methods
        .resolverVote(newBetIndex, 1)
        .accounts({
          signer: r2.publicKey,
          bet: newBet,
        })
        .signers([r2])
        .rpc();
    
      // Fetch bet and assert that it's resolved
      const betAccount = await program.account.bet.fetch(newBet);
      expect(betAccount.votingState.resolved).to.eq(true);
      expect(betAccount.votingState.winner).to.eq(1); // 1 = challenger
    });
  
    it("Winner claims funds and creator receives rent refund", async () => {
      const connection = program.provider.connection;
      // Fetch balances before
      const lockupBalanceBefore = await connection.getBalance(newLockup);
      const creatorBalanceBefore = await connection.getBalance(creator);
      const challengerBalanceBefore = await connection.getBalance(challenger.publicKey);
    
      expect(lockupBalanceBefore).to.eq(
        creatorStake.add(challengerStake).toNumber()
      );
  
      // Challenger calls claim_winnings
      await program.methods
        .claimWinnings(newBetIndex)
        .accounts({
          winner: challenger.publicKey,
          bet: newBet,
          lockup: newLockup,
          creator: creator,
          systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();
    
      // Confirm lockup is empty (should be closed)
      const lockupBalanceAfter = await connection.getBalance(newLockup).catch(() => 0);
      expect(lockupBalanceAfter).to.eq(0);
    
      // Challenger (winner) should have received the full pot
      const challengerBalanceAfter = await connection.getBalance(challenger.publicKey);
      expect(challengerBalanceAfter).to.be.greaterThan(challengerBalanceBefore);
    
      // Creator should have received the rent refund from the bet account
      const creatorBalanceAfter = await connection.getBalance(creator);
      expect(creatorBalanceAfter).to.be.greaterThan(creatorBalanceBefore);
    
      // Try fetching the bet account → should no longer exist
      let betAccountGone = false;
      try {
        await program.account.bet.fetch(newBet);
      } catch (e) {
        betAccountGone = true;
      }
      expect(betAccountGone).to.eq(true);
    });
  }

  
  

});
