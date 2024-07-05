import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Overbid } from "../target/types/overbid";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
  createTransferCheckedInstruction,
  getTokenMetadata,
} from "@solana/spl-token";
import { assert } from "chai";

describe("overbid", () => {
  const provider = anchor.AnchorProvider.env();
  const connection = provider.connection;
  const wallet = provider.wallet as anchor.Wallet;
  anchor.setProvider(provider);

  const program = anchor.workspace.Overbid as Program<Overbid>;

  const bidder = new anchor.web3.Keypair();
  const mintKeypair = new anchor.web3.Keypair();
  const mintKeypair2 = new anchor.web3.Keypair();

  const sourceAccount = getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  const destinationAccount = getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    bidder.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  const [authority, bump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("auth")],
    program.programId
  );

  const uri =
    "https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/DeveloperPortal/metadata.json";

  before(async () => {
    // Transfer SOL from wallet to bidder
    const transferAmount = 10_000_000 * 5;
    const transferTx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: bidder.publicKey,
        lamports: transferAmount,
      })
    );
    await provider.sendAndConfirm(transferTx);
  });

  it("Initialize", async () => {
    const txSignature = await program.methods
      .initialize()
      .accounts({})
      .rpc({ skipPreflight: true, commitment: "confirmed" });
    console.log("Your transaction signature", txSignature);
  });

  it("Mint", async () => {
    const txSignature = await program.methods
      .mint(uri)
      .accounts({
        mintAccount: mintKeypair.publicKey,
      })
      .signers([mintKeypair])
      .rpc({ skipPreflight: true, commitment: "confirmed" });
    console.log("Your transaction signature", txSignature);

    const sourceAccountInfo = await connection.getTokenAccountBalance(
      sourceAccount
    );
    assert.equal(
      sourceAccountInfo.value.uiAmount,
      1,
      "Token was not minted to source account"
    );

    const metadata = await getTokenMetadata(connection, mintKeypair.publicKey);
    const overbidField = metadata.additionalMetadata.find(
      ([key, _]) => key === "overbid"
    );
    assert.exists(overbidField, "Overbid field should exist in metadata");
    assert.equal(overbidField[1], "0", "Overbid should be initialized to '0'");

    const authorityAccount = await program.account.collection.fetch(
      authority,
      "confirmed"
    );
    assert.equal(authorityAccount.bump, bump, "Incorrect bump");
    // assert.lengthOf(authorityAccount.items, 1, "Should have 1 mint");
    // assert.equal(
    //   authorityAccount.items[0].mint.toBase58(),
    //   mintKeypair.publicKey.toBase58(),
    //   "First mint should match"
    // );
    // assert(
    //   authorityAccount.items[0].points.eq(new anchor.BN(0)),
    //   "Points not equal to 0"
    // );
  });

  it("Mint Another", async () => {
    const txSignature = await program.methods
      .mint(uri)
      .accounts({
        mintAccount: mintKeypair2.publicKey,
      })
      .signers([mintKeypair2])
      .rpc({ skipPreflight: true, commitment: "confirmed" });
    console.log("Your transaction signature", txSignature);

    const sourceAccountInfo = await connection.getTokenAccountBalance(
      sourceAccount
    );
    assert.equal(
      sourceAccountInfo.value.uiAmount,
      1,
      "Token was not minted to source account"
    );

    const metadata = await getTokenMetadata(connection, mintKeypair2.publicKey);
    const overbidField = metadata.additionalMetadata.find(
      ([key, _]) => key === "overbid"
    );
    assert.exists(overbidField, "Overbid field should exist in metadata");
    assert.equal(overbidField[1], "0", "Overbid should be initialized to '0'");

    const authorityAccount = await program.account.collection.fetch(
      authority,
      "confirmed"
    );
    assert.equal(authorityAccount.bump, bump, "Incorrect bump");
    // assert.lengthOf(authorityAccount.items, 2, "Should have 2 mint");
    // assert.equal(
    //   authorityAccount.items[0].mint.toBase58(),
    //   mintKeypair.publicKey.toBase58(),
    //   "First mint should match"
    // );
    // assert(
    //   authorityAccount.items[0].points.eq(new anchor.BN(0)),
    //   "Points not equal to 0"
    // );
    // assert.equal(
    //   authorityAccount.items[1].mint.toBase58(),
    //   mintKeypair2.publicKey.toBase58(),
    //   "Second mint should match"
    // );
    // assert(
    //   authorityAccount.items[1].points.eq(new anchor.BN(0)),
    //   "Points not equal to 0"
    // );
  });

  it("Bid", async () => {
    const overbid = 0;
    const amount = 10_000_000;

    const diff = amount - overbid;
    const authorityAccountInitial = await program.account.collection.fetch(
      authority
    );
    const itemCount = authorityAccountInitial.items.length;
    const pointsPerItem = Math.floor(diff / itemCount);
    const remainder = diff % itemCount;

    const ownerInitialBalance = await connection.getBalance(wallet.publicKey);
    const bidderInitialBalance = await connection.getBalance(bidder.publicKey);

    const tx = await program.methods
      .bid(new anchor.BN(amount))
      .accounts({
        payer: bidder.publicKey,
        owner: wallet.publicKey,
        mintAccount: mintKeypair.publicKey,
      })
      .transaction();

    const txSignature = await anchor.web3.sendAndConfirmTransaction(
      connection,
      tx,
      [bidder],
      { commitment: "confirmed" }
    );

    // Assert that the SOL was transferred
    const ownerFinalBalance = await connection.getBalance(wallet.publicKey);
    const bidderFinalBalance = await connection.getBalance(bidder.publicKey);

    // Owner, not going to receive SOL b/c starting overbid = 0, all distributed to items
    // assert.approximately(
    //   ownerFinalBalance,
    //   ownerInitialBalance + amount + remainder,
    //   1000,
    //   "Owner did not receive SOL"
    // );
    assert.approximately(
      bidderFinalBalance,
      bidderInitialBalance - amount,
      10_000_000,
      "Bidder's SOL balance did not decrease as expected"
    );

    const sourceAccountFinal = await getAccount(
      connection,
      sourceAccount,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );

    const destinationAccountFinal = await getAccount(
      connection,
      destinationAccount,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );

    // Assert that the token was transferred
    assert.equal(
      sourceAccountFinal.amount.toString(),
      "0",
      "Token was not transferred from source account"
    );
    assert.equal(
      destinationAccountFinal.amount.toString(),
      "1",
      "Token was not received in destination account"
    );

    // Assert that both token accounts are frozen
    assert(sourceAccountFinal.isFrozen, "Source account is not frozen");
    assert(
      destinationAccountFinal.isFrozen,
      "Destination account is not frozen"
    );

    const metadata = await getTokenMetadata(connection, mintKeypair.publicKey);
    const overbidField = metadata.additionalMetadata.find(
      ([key, _]) => key === "overbid"
    );
    assert.exists(overbidField, "Overbid field should exist in metadata");
    assert.equal(
      overbidField[1],
      amount.toString(),
      "Overbid should be updated to amount"
    );

    const authorityAccountFinal = await program.account.collection.fetch(
      authority
    );
    authorityAccountFinal.items.forEach((item, index) => {
      const initialPoints =
        authorityAccountInitial.items[index].points.toNumber();
      const expectedPoints = initialPoints + pointsPerItem;
      const actualPoints = item.points.toNumber();

      assert.equal(
        actualPoints,
        expectedPoints,
        `Item ${index} did not receive correct points. Expected: ${expectedPoints}, Actual: ${actualPoints}`
      );
    });

    console.log("Your transaction signature", txSignature);
  });

  it("Source bids back", async () => {
    const overbid = 10_000_000;
    const newAmount = overbid * 2; // Higher than the previous bid

    const diff = newAmount - overbid;
    const authorityAccountInitial = await program.account.collection.fetch(
      authority
    );
    const itemCount = authorityAccountInitial.items.length;
    const pointsPerItem = Math.floor(diff / itemCount);
    const remainder = diff % itemCount;

    const ownerInitialBalance = await connection.getBalance(wallet.publicKey);
    const bidderInitialBalance = await connection.getBalance(bidder.publicKey);

    const tx = await program.methods
      .bid(new anchor.BN(newAmount))
      .accounts({
        payer: wallet.publicKey,
        owner: bidder.publicKey,
        mintAccount: mintKeypair.publicKey,
      })
      .transaction();

    const txSignature = await anchor.web3.sendAndConfirmTransaction(
      connection,
      tx,
      [wallet.payer],
      { commitment: "confirmed" }
    );

    // Assert that the SOL was transferred
    const ownerFinalBalance = await connection.getBalance(wallet.publicKey);
    const bidderFinalBalance = await connection.getBalance(bidder.publicKey);

    assert.approximately(
      ownerFinalBalance,
      ownerInitialBalance - newAmount,
      1_000_000,
      "Owner's SOL balance did not decrease"
    );
    assert.approximately(
      bidderFinalBalance,
      bidderInitialBalance + overbid + remainder,
      1_000,
      "Bidder did not receive SOL"
    );

    const sourceAccountFinal = await getAccount(
      connection,
      sourceAccount,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );

    const destinationAccountFinal = await getAccount(
      connection,
      destinationAccount,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );

    // Assert that the token was transferred back
    assert.equal(
      sourceAccountFinal.amount.toString(),
      "1",
      "Token was not transferred back to source account"
    );
    assert.equal(
      destinationAccountFinal.amount.toString(),
      "0",
      "Token was not transferred from destination account"
    );

    // Assert that both token accounts are still frozen
    assert(sourceAccountFinal.isFrozen, "Source account is not frozen");
    assert(
      destinationAccountFinal.isFrozen,
      "Destination account is not frozen"
    );

    // Check that the overbid value was updated
    const metadata = await getTokenMetadata(connection, mintKeypair.publicKey);
    const overbidField = metadata.additionalMetadata.find(
      ([key, _]) => key === "overbid"
    );
    assert.exists(overbidField, "Overbid field should exist in metadata");
    assert.equal(
      overbidField[1],
      newAmount.toString(),
      "Overbid should be updated to new amount"
    );

    const authorityAccountFinal = await program.account.collection.fetch(
      authority
    );
    authorityAccountFinal.items.forEach((item, index) => {
      const initialPoints =
        authorityAccountInitial.items[index].points.toNumber();
      const expectedPoints = initialPoints + pointsPerItem;
      const actualPoints = item.points.toNumber();

      assert.equal(
        actualPoints,
        expectedPoints,
        `Item ${index} did not receive correct points. Expected: ${expectedPoints}, Actual: ${actualPoints}`
      );
    });
    console.log("Your transaction signature", txSignature);
  });

  it("Attempt to bid lower than current overbid", async () => {
    const lowerAmount = 150; // Lower than the previous bid
    try {
      const tx = await program.methods
        .bid(new anchor.BN(lowerAmount))
        .accounts({
          payer: bidder.publicKey,
          owner: wallet.publicKey,
          mintAccount: mintKeypair.publicKey,
        })
        .transaction();

      await anchor.web3.sendAndConfirmTransaction(connection, tx, [bidder], {
        commitment: "confirmed",
        skipPreflight: true,
      });

      // If we reach here, the transaction succeeded when it should have failed
      assert.fail("Bid with lower amount should have failed");
    } catch (error) {
      assert.include(
        error.message,
        'Status: ({"err":{"InstructionError":[0,{"Custom":6002}]}})',
        "Expected BidTooLow error"
      );
    }

    // Check that the overbid value was not updated
    const metadata = await getTokenMetadata(connection, mintKeypair.publicKey);
    const overbidField = metadata.additionalMetadata.find(
      ([key, _]) => key === "overbid"
    );
    assert.exists(overbidField, "Overbid field should exist in metadata");
    assert.equal(
      overbidField[1],
      "20000000",
      "Overbid should not have changed"
    );
  });

  it("Redeem", async () => {
    const txSignature = await program.methods
      .redeem()
      .accounts({ mintAccount: mintKeypair.publicKey })
      .rpc({ skipPreflight: true, commitment: "confirmed" });
    console.log("Your transaction signature", txSignature);
  });

  it("Redeem, Wrong owner expect fail", async () => {
    try {
      const tx = await program.methods
        .redeem()
        .accounts({
          owner: bidder.publicKey,
          mintAccount: mintKeypair.publicKey,
        })
        .transaction();

      const txSignature = await anchor.web3.sendAndConfirmTransaction(
        connection,
        tx,
        [bidder],
        { commitment: "confirmed", skipPreflight: true }
      );

      console.log("Your transaction signature", txSignature);

      // If we reach here, the transaction succeeded when it should have failed
      assert.fail("should have failed");
    } catch (error) {
      assert.include(
        error.message,
        'Status: ({"err":{"InstructionError":[0,{"Custom":6003}]}})',
        "Expected WrongOwner error"
      );
    }
  });
});
