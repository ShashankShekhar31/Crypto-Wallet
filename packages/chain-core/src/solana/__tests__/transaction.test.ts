import { describe, expect, it } from "vitest";

import { createSolanaUnsignedTransaction } from "../transaction.js";

const VALID_ADDRESS = "11111111111111111111111111111111";

const SECOND_ADDRESS = "SysvarRent111111111111111111111111111111111";

const BLOCKHASH = "EkSn1Z7w3qK6s7J7wVYQW7fY6Y9J5u4p";

function createInstruction() {
  return {
    programId: VALID_ADDRESS,
    accounts: [SECOND_ADDRESS],
    data: new Uint8Array([1, 2, 3]),
  };
}

describe("Solana transaction construction", () => {
  it("creates an unsigned transaction", () => {
    const transaction = createSolanaUnsignedTransaction({
      feePayer: VALID_ADDRESS,
      recentBlockhash: BLOCKHASH,
      instructions: [createInstruction()],
    });

    expect(transaction.feePayer).toBe(VALID_ADDRESS);

    expect(transaction.recentBlockhash).toBe(BLOCKHASH);

    expect(transaction.instructions).toHaveLength(1);

    expect(transaction.instructions[0]?.programId).toBe(VALID_ADDRESS);

    expect(transaction.instructions[0]?.accounts).toEqual([SECOND_ADDRESS]);

    expect(transaction.instructions[0]?.data).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("trims the fee payer and blockhash", () => {
    const transaction = createSolanaUnsignedTransaction({
      feePayer: `  ${VALID_ADDRESS}  `,
      recentBlockhash: `  ${BLOCKHASH}  `,
      instructions: [
        {
          ...createInstruction(),
          programId: `  ${VALID_ADDRESS}  `,
          accounts: [`  ${SECOND_ADDRESS}  `],
        },
      ],
    });

    expect(transaction.feePayer).toBe(VALID_ADDRESS);

    expect(transaction.recentBlockhash).toBe(BLOCKHASH);

    expect(transaction.instructions[0]?.programId).toBe(VALID_ADDRESS);

    expect(transaction.instructions[0]?.accounts).toEqual([SECOND_ADDRESS]);
  });

  it("copies instruction data", () => {
    const data = new Uint8Array([1, 2, 3]);

    const transaction = createSolanaUnsignedTransaction({
      feePayer: VALID_ADDRESS,
      recentBlockhash: BLOCKHASH,
      instructions: [
        {
          ...createInstruction(),
          data,
        },
      ],
    });

    data[0] = 99;

    expect(transaction.instructions[0]?.data).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("rejects an empty recent blockhash", () => {
    expect(() =>
      createSolanaUnsignedTransaction({
        feePayer: VALID_ADDRESS,
        recentBlockhash: "   ",
        instructions: [createInstruction()],
      }),
    ).toThrow("Solana recent blockhash is required");
  });

  it("rejects a transaction without instructions", () => {
    expect(() =>
      createSolanaUnsignedTransaction({
        feePayer: VALID_ADDRESS,
        recentBlockhash: BLOCKHASH,
        instructions: [],
      }),
    ).toThrow("Solana transaction must have at least one instruction");
  });

  it("rejects an invalid fee payer", () => {
    expect(() =>
      createSolanaUnsignedTransaction({
        feePayer: "not-a-solana-address",
        recentBlockhash: BLOCKHASH,
        instructions: [createInstruction()],
      }),
    ).toThrow("Invalid Solana address");
  });

  it("rejects an invalid instruction program id", () => {
    expect(() =>
      createSolanaUnsignedTransaction({
        feePayer: VALID_ADDRESS,
        recentBlockhash: BLOCKHASH,
        instructions: [
          {
            ...createInstruction(),
            programId: "invalid",
          },
        ],
      }),
    ).toThrow("Invalid Solana address");
  });

  it("rejects an instruction without accounts", () => {
    expect(() =>
      createSolanaUnsignedTransaction({
        feePayer: VALID_ADDRESS,
        recentBlockhash: BLOCKHASH,
        instructions: [
          {
            ...createInstruction(),
            accounts: [],
          },
        ],
      }),
    ).toThrow("Solana instruction must have at least one account");
  });

  it("rejects an invalid instruction account", () => {
    expect(() =>
      createSolanaUnsignedTransaction({
        feePayer: VALID_ADDRESS,
        recentBlockhash: BLOCKHASH,
        instructions: [
          {
            ...createInstruction(),
            accounts: ["invalid"],
          },
        ],
      }),
    ).toThrow("Invalid Solana address");
  });

  it("does not mutate the input instruction arrays", () => {
    const accounts = [SECOND_ADDRESS];
    const instructions = [
      {
        ...createInstruction(),
        accounts,
      },
    ];

    const transaction = createSolanaUnsignedTransaction({
      feePayer: VALID_ADDRESS,
      recentBlockhash: BLOCKHASH,
      instructions,
    });

    accounts.push(VALID_ADDRESS);
    instructions.push(createInstruction());

    expect(transaction.instructions).toHaveLength(1);

    expect(transaction.instructions[0]?.accounts).toEqual([SECOND_ADDRESS]);
  });
});
