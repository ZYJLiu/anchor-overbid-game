import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import { IdlAccounts, Program } from "@coral-xyz/anchor";
import type { Overbid } from "./idlType";
import idl from "./idl.json";

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

export const program = new Program(idl as Overbid, {
  connection,
});

export const [authority, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from("auth")],
  program.programId,
);

export type CollectionAccount = IdlAccounts<Overbid>["collection"];
