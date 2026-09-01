import {
  validateSolanaAddress,
} from "./address.js";

import type {
  SolanaInstruction,
  SolanaUnsignedTransaction,
} from "./transaction.js";

export interface SolanaAccountMeta {
  readonly address: string;
  readonly isSigner: boolean;
  readonly isWritable: boolean;
}

export interface SolanaCompiledInstruction {
  readonly programIdIndex: number;
  readonly accountIndexes: readonly number[];
  readonly data: Uint8Array;
}

export interface SolanaTransactionMessage {
  readonly feePayer: string;
  readonly recentBlockhash: string;
  readonly accountKeys: readonly SolanaAccountMeta[];
  readonly instructions: readonly SolanaCompiledInstruction[];
}

function normalizeAccountMeta(
  account: SolanaAccountMeta,
): SolanaAccountMeta {
  const address = validateSolanaAddress(
    account.address,
  );

  return Object.freeze({
    address,
    isSigner: Boolean(account.isSigner),
    isWritable: Boolean(account.isWritable),
  });
}

function mergeAccountMeta(
  existing: SolanaAccountMeta,
  incoming: SolanaAccountMeta,
): SolanaAccountMeta {
  return Object.freeze({
    address: existing.address,
    isSigner:
      existing.isSigner || incoming.isSigner,
    isWritable:
      existing.isWritable || incoming.isWritable,
  });
}

function addAccount(
  accounts: SolanaAccountMeta[],
  indexes: Map<string, number>,
  account: SolanaAccountMeta,
): number {
  const normalized =
    normalizeAccountMeta(account);

  const existingIndex =
    indexes.get(normalized.address);

  if (existingIndex !== undefined) {
    const existing =
      accounts[existingIndex];

    if (existing === undefined) {
      throw new Error(
        "Solana account index is inconsistent",
      );
    }

    accounts[existingIndex] =
      mergeAccountMeta(
        existing,
        normalized,
      );

    return existingIndex;
  }

  const index = accounts.length;

  accounts.push(normalized);
  indexes.set(
    normalized.address,
    index,
  );

  return index;
}

function compileInstruction(
  instruction: SolanaInstruction,
  accounts: SolanaAccountMeta[],
  indexes: Map<string, number>,
): SolanaCompiledInstruction {
  const programId = validateSolanaAddress(
    instruction.programId,
  );

  const programIdIndex = addAccount(
    accounts,
    indexes,
    {
      address: programId,
      isSigner: false,
      isWritable: false,
    },
  );

  const accountIndexes = instruction.accounts.map(
    (address) =>
      addAccount(
        accounts,
        indexes,
        {
          address,
          isSigner: false,
          isWritable: false,
        },
      ),
  );

  return Object.freeze({
    programIdIndex,
    accountIndexes: Object.freeze([
      ...accountIndexes,
    ]),
    data: new Uint8Array(instruction.data),
  });
}

export function compileSolanaTransactionMessage(
  transaction: SolanaUnsignedTransaction,
): SolanaTransactionMessage {
  const feePayer = validateSolanaAddress(
    transaction.feePayer,
  );

  const recentBlockhash =
    transaction.recentBlockhash.trim();

  if (!recentBlockhash) {
    throw new Error(
      "Solana recent blockhash is required",
    );
  }

  const accounts: SolanaAccountMeta[] = [];
  const indexes = new Map<string, number>();

  /*
   * Solana requires the fee payer to be the
   * first account and it is always a signer.
   */
  addAccount(
    accounts,
    indexes,
    {
      address: feePayer,
      isSigner: true,
      isWritable: true,
    },
  );

  const instructions =
    transaction.instructions.map(
      (instruction) =>
        compileInstruction(
          instruction,
          accounts,
          indexes,
        ),
    );

  return Object.freeze({
    feePayer,
    recentBlockhash,
    accountKeys: Object.freeze([
      ...accounts,
    ]),
    instructions: Object.freeze([
      ...instructions,
    ]),
  });
}