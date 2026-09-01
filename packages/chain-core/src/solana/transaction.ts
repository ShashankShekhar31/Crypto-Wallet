import { validateSolanaAddress } from "./address.js";

export interface SolanaInstruction {
  readonly programId: string;
  readonly accounts: readonly string[];
  readonly data: Uint8Array;
}

export interface SolanaTransactionRequest {
  readonly feePayer: string;
  readonly recentBlockhash: string;
  readonly instructions: readonly SolanaInstruction[];
}

export interface SolanaUnsignedTransaction {
  readonly feePayer: string;
  readonly recentBlockhash: string;
  readonly instructions: readonly SolanaInstruction[];
}

function normalizeBlockhash(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("Solana recent blockhash is required");
  }

  return normalized;
}

function normalizeInstruction(instruction: SolanaInstruction): SolanaInstruction {
  const programId = validateSolanaAddress(instruction.programId);

  if (instruction.accounts.length === 0) {
    throw new Error("Solana instruction must have at least one account");
  }

  const accounts = instruction.accounts.map((account) => validateSolanaAddress(account));

  return Object.freeze({
    programId,
    accounts: Object.freeze([...accounts]),
    data: new Uint8Array(instruction.data),
  });
}

export function createSolanaUnsignedTransaction(
  input: SolanaTransactionRequest,
): SolanaUnsignedTransaction {
  const feePayer = validateSolanaAddress(input.feePayer);

  const recentBlockhash = normalizeBlockhash(input.recentBlockhash);

  if (input.instructions.length === 0) {
    throw new Error("Solana transaction must have at least one instruction");
  }

  const instructions = input.instructions.map(normalizeInstruction);

  return Object.freeze({
    feePayer,
    recentBlockhash,
    instructions: Object.freeze([...instructions]),
  });
}
