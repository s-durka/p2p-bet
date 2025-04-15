## 🍺 Hold My Beer 🍺

It’s Thursday night. You and your best friend are on the couch, controllers in hand, locked in the eternal battle that is your FIFA rivalry. The trash talk is getting real.

> “Relax bro, I beat you last time 4–1. You sure you wanna run this again?”

You smirk. You’ve been waiting for this rematch.

You both pull out your phones, open the app, and set the terms:  
**1v1 FIFA. 0.5 SOL. Winner takes all.**  
Smart contract locks it in—no backing out now.

Kickoff. Sweat. Rage.  
Extra time. 2–2. You bury the winner in the 120th minute.

Final whistle.  
Your phone buzzes—**payment received.**

No IOUs. No “I’ll pay you later.”  
Just pure, trustless victory.


# Solana programs

Smart contracts - call `createBet` specifying the bet description, challenger, the stakes and, optionally, a committe of `resolvers`. 

Wait for the challenger to `acceptBet`, transfer his fair share of SOL into the on-chain **escrow vault** and play. Decide on the winner. If a gentlemens' agreement is reached between you two, money goes to the winner. Sore loser? Don't worry. Provide proof* of the win and let the `resolvers` decide with a majority decision.

*(*TODO - proof element not yet implemented. Can be a link to a photo, a website, maybe even a ZK proof in the future)*

#### To build and test the Solana contracts, run:
```
anchor build
anchor test
```
