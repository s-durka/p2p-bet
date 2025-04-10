import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { P2pBet } from "../target/types/p2p_bet";

describe("p2p_bet", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.p2pBet as Program<P2pBet>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
