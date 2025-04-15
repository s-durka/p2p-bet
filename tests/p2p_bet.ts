import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { P2pBet } from "../target/types/p2p_bet";
import { SystemProgram, LAMPORTS_PER_SOL, PublicKey, Keypair } from "@solana/web3.js";
import BN from "bn.js";

describe("P2P Bet", () => {
  anchor.setProvider(anchor.AnchorProvider.local());
  const program = anchor.workspace.P2pBet as Program<P2pBet>;
  const connection = program.provider.connection;

  const creator = program.provider.publicKey;
  const challenger = Keypair.generate();
  const resolver1 = Keypair.generate();
  const resolver2 = Keypair.generate();
  const resolver3 = Keypair.generate();

  const creatorStake = new BN(1 * LAMPORTS_PER_SOL);
  const challengerStake = new BN(1.3 * LAMPORTS_PER_SOL);
  const deadline = new BN(Math.floor(Date.now() / 1000) + 86400); // 24h from now

  // --- Bet #1: Player vote flow ---
  const betIndex1 = new BN(0);
  const [bet1] = PublicKey.findProgramAddressSync(
    [Buffer.from("bet"), betIndex1.toArrayLike(Buffer, "le", 8)],
    program.programId
  );
  const [lockup1] = PublicKey.findProgramAddressSync(
    [Buffer.from("lockup"), betIndex1.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  // --- Bet #2: Resolver vote flow ---
  const betIndex2 = new BN(2);
  const [bet2] = PublicKey.findProgramAddressSync(
    [Buffer.from("bet"), betIndex2.toArrayLike(Buffer, "le", 8)],
    program.programId
  );
  const [lockup2] = PublicKey.findProgramAddressSync(
    [Buffer.from("lockup"), betIndex2.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  async function airdrop(key: PublicKey, amount: number) {
    const sig = await connection.requestAirdrop(key, amount);
    const blockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, ...blockhash }, "confirmed");
  }

  it("Creates bet (player voting)", async () => {
    await program.methods
      .createBet(
        betIndex1,
        [resolver1.publicKey, resolver2.publicKey],
        creatorStake,
        challengerStake,
        challenger.publicKey,
        deadline
      )
      .accounts({
        creator,
        lockup: lockup1,
        bet: bet1,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const lockupBalance = await connection.getBalance(lockup1);
    expect(lockupBalance).to.eq(creatorStake.toNumber());

    const bet = await program.account.bet.fetch(bet1);
    expect(bet.creator.toString()).to.eq(creator.toString());
    expect(bet.challenger.toString()).to.eq(challenger.publicKey.toString());
    expect(bet.creatorStake.toNumber()).to.eq(creatorStake.toNumber());
    expect(bet.challengerStake.toNumber()).to.eq(challengerStake.toNumber());
    expect(bet.accepted).to.be.false;
    expect(bet.votingState.resolved).to.be.false;
    expect(bet.deadline.toNumber()).to.eq(deadline.toNumber());
    expect(bet.resolverGroup.map(pk => pk.toString())).to.include.members([
      resolver1.publicKey.toString(),
      resolver2.publicKey.toString()
    ]);
  });

  it("Challenger accepts bet and transfers stake", async () => {
    await airdrop(challenger.publicKey, 2 * LAMPORTS_PER_SOL);

    const before = await connection.getBalance(lockup1);
    await program.methods
      .acceptBet(betIndex1)
      .accounts({
        challenger: challenger.publicKey,
        lockup: lockup1,
        bet: bet1,
        systemProgram: SystemProgram.programId
      })
      .signers([challenger])
      .rpc();

    const after = await connection.getBalance(lockup1);
    expect(after).to.eq(before + challengerStake.toNumber());

    const bet = await program.account.bet.fetch(bet1);
    expect(bet.accepted).to.be.true;
  });

  it("Players vote and resolve the bet", async () => {
    await program.methods
      .castPlayerVote(betIndex1, 0)
      .accounts({ signer: creator, bet: bet1 })
      .rpc();

    await program.methods
      .castPlayerVote(betIndex1, 0)
      .accounts({ signer: challenger.publicKey, bet: bet1 })
      .signers([challenger])
      .rpc();

    const bet = await program.account.bet.fetch(bet1);
    expect(bet.votingState.creatorVote).to.eq(0);
    expect(bet.votingState.challengerVote).to.eq(0);
    expect(bet.votingState.resolved).to.be.true;
    expect(bet.votingState.winner).to.eq(0);
  });

  it("Creates bet (resolver voting)", async () => {
    await airdrop(challenger.publicKey, 5 * LAMPORTS_PER_SOL);

    const challBalanceBefore = await connection.getBalance(challenger.publicKey);

    await program.methods
      .createBet(
        betIndex2,
        [resolver1.publicKey, resolver2.publicKey, resolver3.publicKey],
        creatorStake,
        challengerStake,
        challenger.publicKey,
        deadline
      )
      .accounts({
        creator,
        lockup: lockup2,
        bet: bet2,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .acceptBet(betIndex2)
      .accounts({
        challenger: challenger.publicKey,
        lockup: lockup2,
        bet: bet2,
        systemProgram: SystemProgram.programId,
      })
      .signers([challenger])
      .rpc();

    const challBalanceAfter = await connection.getBalance(challenger.publicKey);
    expect(challBalanceAfter).to.eq(challBalanceBefore - challengerStake.toNumber());

  });

  it("Resolvers vote and resolve with 2/3 majority", async () => {
    await program.methods
      .resolverVote(betIndex2, 1)
      .accounts({ signer: resolver1.publicKey, bet: bet2 })
      .signers([resolver1])
      .rpc();

    await program.methods
      .resolverVote(betIndex2, 1)
      .accounts({ signer: resolver2.publicKey, bet: bet2 })
      .signers([resolver2])
      .rpc();

    const bet = await program.account.bet.fetch(bet2);
    expect(bet.votingState.resolved).to.be.true;
    expect(bet.votingState.winner).to.eq(1);
  });

  it("Winner claims funds, creator gets rent refund", async () => {
    const beforeLockup = await connection.getBalance(lockup2);
    const beforeCreator = await connection.getBalance(creator);
    const beforeChallenger = await connection.getBalance(challenger.publicKey);

    await program.methods
      .claimWinnings(betIndex2)
      .accounts({
        winner: challenger.publicKey,
        bet: bet2,
        lockup: lockup2,
        creator,
        systemProgram: SystemProgram.programId
      })
      .signers([challenger])
      .rpc();

    const afterLockup = await connection.getBalance(lockup2).catch(() => 0);
    const afterCreator = await connection.getBalance(creator);
    const afterChallenger = await connection.getBalance(challenger.publicKey);

    expect(afterLockup).to.eq(0);
    expect(afterChallenger).to.be.greaterThan(beforeChallenger);
    expect(afterCreator).to.be.greaterThan(beforeCreator);

    let betGone = false;
    try {
      await program.account.bet.fetch(bet2);
    } catch {
      betGone = true;
    }
    expect(betGone).to.eq(true);
  });
});
