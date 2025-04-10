import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { P2pBet } from "../target/types/p2p_bet";
import { SystemProgram, LAMPORTS_PER_SOL, PublicKey, Keypair } from "@solana/web3.js";
import BN from "bn.js";


describe("create_bet", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.P2pBet as Program<P2pBet>;

  const creator = program.provider.publicKey;

  const challenger = Keypair.generate();
  const resolver1 = Keypair.generate();
  const resolver2 = Keypair.generate();

  const betIndex = new BN(0);
  const creatorStake = new BN(1 * LAMPORTS_PER_SOL);
  const challengerStake = new BN(1.3 * LAMPORTS_PER_SOL);
  const deadline = new BN(Math.floor(Date.now() / 1000) + 86400); // 24 hours from now

  // Derive PDAs
  const [bet] = PublicKey.findProgramAddressSync(
    [Buffer.from("bet"), betIndex.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  const [lockup] = PublicKey.findProgramAddressSync(
    [Buffer.from("lockup"), betIndex.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  it("Creates a bet with lockup and terms", async () => {
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
        creator: creator,
        lockup,
        bet,
        systemProgram: SystemProgram.programId
      })
      .rpc();

    // Check lockup balance (should be creatorStake)
    const lockupBalance = await program.provider.connection.getBalance(lockup);
    expect(lockupBalance).to.eq(creatorStake.toNumber());

    // Fetch and check the Bet account
    const betAccount = await program.account.bet.fetch(bet);

    expect(betAccount.creator.toString()).to.eq(creator.toString());
    expect(betAccount.challenger.toString()).to.eq(challenger.publicKey.toString());
    expect(betAccount.creatorStake.toNumber()).to.eq(creatorStake.toNumber());
    expect(betAccount.challengerStake.toNumber()).to.eq(challengerStake.toNumber());
    expect(betAccount.accepted).to.be.false;
    expect(betAccount.resolved).to.be.false;
    expect(betAccount.deadline.toNumber()).to.eq(deadline.toNumber());

    expect(betAccount.resolverGroup.length).to.eq(2);
    expect(betAccount.resolverGroup[0].toString()).to.eq(resolver1.publicKey.toString());
    expect(betAccount.resolverGroup[1].toString()).to.eq(resolver2.publicKey.toString());
  });
});

