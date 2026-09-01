import { describe, expect, it } from "vitest";

import { compileSolanaTransactionMessage } from "../message.js";

import {
  createSolanaSignedTransaction,
  serializeSolanaSignedTransaction,
} from "../signed-transaction.js";

import type { SolanaInstruction } from "../transaction.js";

const FEE_PAYER = "So11111111111111111111111111111111111111112";

const PROGRAM_ID = "11111111111111111111111111111111";

const BLOCKHASH = "11111111111111111111111111111111";

const instruction: SolanaInstruction = {
  programId: PROGRAM_ID,
  accounts: [FEE_PAYER],
  data: new Uint8Array([1, 2, 3]),
};

function createTransaction() {
  return {
    feePayer: FEE_PAYER,
    recentBlockhash: BLOCKHASH,
    instructions: [instruction],
  };
}

function createSignature(value: number): Uint8Array {
  const signature = new Uint8Array(64);

  signature.fill(value);

  return signature;
}

describe("Solana transaction signing integration", () => {
  it("compiles a transaction message", () => {
    const message = compileSolanaTransactionMessage(createTransaction());

    expect(message.accountKeys.length).toBeGreaterThan(0);

    expect(message.instructions.length).toBe(1);
  });

  it("creates a signed transaction from the compiled message", () => {
    const message = compileSolanaTransactionMessage(createTransaction());

    const signature = createSignature(7);

    const signed = createSolanaSignedTransaction(message, [signature]);

    expect(signed.signatures.length).toBe(1);

    expect(signed.message).toBeInstanceOf(Uint8Array);
  });

  it("preserves the exact serialized message", () => {
    const message = compileSolanaTransactionMessage(createTransaction());

    const signature = createSignature(9);

    const signed = createSolanaSignedTransaction(message, [signature]);

    const serialized = serializeSolanaSignedTransaction(signed);

    expect([...serialized.slice(65)]).toEqual([...signed.message]);
  });

  it("places the signature before the message", () => {
    const message = compileSolanaTransactionMessage(createTransaction());

    const signature = createSignature(42);

    const signed = createSolanaSignedTransaction(message, [signature]);

    const serialized = serializeSolanaSignedTransaction(signed);

    expect([...serialized.slice(1, 65)]).toEqual([...signature]);
  });

  it("produces deterministic transaction bytes", () => {
    const firstMessage = compileSolanaTransactionMessage(createTransaction());

    const secondMessage = compileSolanaTransactionMessage(createTransaction());

    const first = createSolanaSignedTransaction(firstMessage, [createSignature(5)]);

    const second = createSolanaSignedTransaction(secondMessage, [createSignature(5)]);

    expect(serializeSolanaSignedTransaction(first)).toEqual(
      serializeSolanaSignedTransaction(second),
    );
  });
});
