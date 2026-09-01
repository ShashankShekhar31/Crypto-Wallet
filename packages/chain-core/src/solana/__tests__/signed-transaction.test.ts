import { describe, expect, it } from "vitest";

import {
  createSolanaSignedTransaction,
  serializeSolanaSignedTransaction,
} from "../signed-transaction.js";

import type { SolanaTransactionMessage } from "../message.js";

const FEE_PAYER = "So11111111111111111111111111111111111111112";

const PROGRAM_ID = "11111111111111111111111111111111";

const BLOCKHASH = "11111111111111111111111111111111";

function createMessage(): SolanaTransactionMessage {
  return {
    feePayer: FEE_PAYER,
    recentBlockhash: BLOCKHASH,
    accountKeys: [
      {
        address: FEE_PAYER,
        isSigner: true,
        isWritable: true,
      },
      {
        address: PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
    ],
    instructions: [
      {
        programIdIndex: 1,
        accountIndexes: [],
        data: new Uint8Array(),
      },
    ],
  };
}

function createSignature(value: number): Uint8Array {
  const signature = new Uint8Array(64);

  signature.fill(value);

  return signature;
}

describe("Solana signed transaction", () => {
  it("creates a signed transaction", () => {
    const signature = createSignature(7);

    const result = createSolanaSignedTransaction(createMessage(), [signature]);

    expect(result.signatures.length).toBe(1);

    expect(result.signatures[0]).toEqual(signature);

    expect(result.message).toBeInstanceOf(Uint8Array);
  });

  it("serializes signature count", () => {
    const result = createSolanaSignedTransaction(createMessage(), [createSignature(7)]);

    const serialized = serializeSolanaSignedTransaction(result);

    expect(serialized[0]).toBe(1);
  });

  it("serializes the signature before the message", () => {
    const result = createSolanaSignedTransaction(createMessage(), [createSignature(42)]);

    const serialized = serializeSolanaSignedTransaction(result);

    expect(serialized[1]).toBe(42);
    expect(serialized[64]).toBe(42);
  });

  it("places the serialized message after signatures", () => {
    const result = createSolanaSignedTransaction(createMessage(), [createSignature(42)]);

    const serialized = serializeSolanaSignedTransaction(result);

    expect([...serialized.slice(65)]).toEqual([...result.message]);
  });

  it("rejects a signature count mismatch", () => {
    expect(() => createSolanaSignedTransaction(createMessage(), [])).toThrow(
      "Solana transaction signature count does not match required signatures",
    );
  });

  it("rejects a short signature", () => {
    expect(() => createSolanaSignedTransaction(createMessage(), [new Uint8Array(63)])).toThrow(
      "Solana transaction signature must be 64 bytes",
    );
  });

  it("rejects a long signature", () => {
    expect(() => createSolanaSignedTransaction(createMessage(), [new Uint8Array(65)])).toThrow(
      "Solana transaction signature must be 64 bytes",
    );
  });

  it("returns immutable transaction structure", () => {
    const result = createSolanaSignedTransaction(createMessage(), [createSignature(1)]);

    expect(Object.isFrozen(result)).toBe(true);

    expect(Object.isFrozen(result.signatures)).toBe(true);
  });

  it("does not mutate the input signature", () => {
    const signature = createSignature(9);

    createSolanaSignedTransaction(createMessage(), [signature]);

    expect(signature[0]).toBe(9);
  });

  it("produces deterministic bytes", () => {
    const message = createMessage();

    const first = createSolanaSignedTransaction(message, [createSignature(3)]);

    const second = createSolanaSignedTransaction(message, [createSignature(3)]);

    expect(serializeSolanaSignedTransaction(first)).toEqual(
      serializeSolanaSignedTransaction(second),
    );
  });
});
