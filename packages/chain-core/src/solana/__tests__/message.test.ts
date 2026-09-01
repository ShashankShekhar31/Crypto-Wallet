import { describe, expect, it } from "vitest";

import { compileSolanaTransactionMessage } from "../message.js";

import type { SolanaUnsignedTransaction } from "../transaction.js";

const FEE_PAYER = "11111111111111111111111111111111";

const PROGRAM_ID = "11111111111111111111111111111111";

function createTransaction(
  overrides: Partial<SolanaUnsignedTransaction> = {},
): SolanaUnsignedTransaction {
  return {
    feePayer: FEE_PAYER,
    recentBlockhash: "EkSn1Z7w3qK6s7J7wVYQW7fY6Y9J5u4p",
    instructions: [
      {
        programId: PROGRAM_ID,
        accounts: [FEE_PAYER],
        data: new Uint8Array([1, 2, 3]),
      },
    ],
    ...overrides,
  };
}

describe("compileSolanaTransactionMessage", () => {
  it("puts the fee payer first", () => {
    const message = compileSolanaTransactionMessage(createTransaction());

    expect(message.accountKeys[0]).toEqual({
      address: FEE_PAYER,
      isSigner: true,
      isWritable: true,
    });
  });

  it("marks the fee payer as signer and writable", () => {
    const message = compileSolanaTransactionMessage(createTransaction());

    expect(message.accountKeys[0].isSigner).toBe(true);

    expect(message.accountKeys[0].isWritable).toBe(true);
  });

  it("includes the program id in account keys", () => {
    const message = compileSolanaTransactionMessage(
      createTransaction({
        instructions: [
          {
            programId: PROGRAM_ID,
            accounts: [],
            data: new Uint8Array(),
          },
        ],
      }),
    );

    expect(message.accountKeys.some((account) => account.address === PROGRAM_ID)).toBe(true);
  });

  it("compiles program id indexes", () => {
    const message = compileSolanaTransactionMessage(createTransaction());

    const instruction = message.instructions[0];

    expect(instruction.programIdIndex).toBe(0);
  });

  it("compiles account indexes", () => {
    const account = "11111111111111111111111111111111";

    const message = compileSolanaTransactionMessage(
      createTransaction({
        instructions: [
          {
            programId: PROGRAM_ID,
            accounts: [account],
            data: new Uint8Array([7]),
          },
        ],
      }),
    );

    expect(message.instructions[0].accountIndexes).toEqual([0]);
  });

  it("copies instruction data", () => {
    const data = new Uint8Array([1, 2, 3]);

    const transaction = createTransaction({
      instructions: [
        {
          programId: PROGRAM_ID,
          accounts: [FEE_PAYER],
          data,
        },
      ],
    });

    const message = compileSolanaTransactionMessage(transaction);

    expect(message.instructions[0].data).toEqual(new Uint8Array([1, 2, 3]));

    expect(message.instructions[0].data).not.toBe(data);
  });

  it("deduplicates account keys", () => {
    const message = compileSolanaTransactionMessage(
      createTransaction({
        instructions: [
          {
            programId: PROGRAM_ID,
            accounts: [FEE_PAYER, FEE_PAYER],
            data: new Uint8Array(),
          },
        ],
      }),
    );

    const feePayerEntries = message.accountKeys.filter((account) => account.address === FEE_PAYER);

    expect(feePayerEntries).toHaveLength(1);
  });

  it("preserves the recent blockhash", () => {
    const blockhash = "EkSn1Z7w3qK6s7J7wVYQW7fY6Y9J5u4p";

    const message = compileSolanaTransactionMessage(
      createTransaction({
        recentBlockhash: blockhash,
      }),
    );

    expect(message.recentBlockhash).toBe(blockhash);
  });

  it("rejects an invalid fee payer", () => {
    expect(() =>
      compileSolanaTransactionMessage(
        createTransaction({
          feePayer: "not-a-solana-address",
        }),
      ),
    ).toThrow("Invalid Solana address");
  });

  it("rejects an empty blockhash", () => {
    expect(() =>
      compileSolanaTransactionMessage(
        createTransaction({
          recentBlockhash: "   ",
        }),
      ),
    ).toThrow("Solana recent blockhash is required");
  });

  it("returns an immutable message", () => {
    const message = compileSolanaTransactionMessage(createTransaction());

    expect(Object.isFrozen(message)).toBe(true);

    expect(Object.isFrozen(message.accountKeys)).toBe(true);

    expect(Object.isFrozen(message.instructions)).toBe(true);
  });
});
