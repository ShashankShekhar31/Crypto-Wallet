import { describe, expect, it } from "vitest";

import { serializeSolanaTransactionMessage } from "../serializer.js";

import type { SolanaTransactionMessage } from "../message.js";

const FEE_PAYER = "So11111111111111111111111111111111111111112";

const PROGRAM_ID = "11111111111111111111111111111111";

const RECENT_BLOCKHASH = "1thX6LZfHDZZKUs92febYZhYRcXddmzfzF2NvTkPNE";

function createMessage(
  overrides: Partial<SolanaTransactionMessage> = {},
): SolanaTransactionMessage {
  return {
    feePayer: FEE_PAYER,
    recentBlockhash: RECENT_BLOCKHASH,
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
    ...overrides,
  };
}

describe("serializeSolanaTransactionMessage", () => {
  it("serializes a transaction message", () => {
    const result = serializeSolanaTransactionMessage(createMessage());

    expect(result).toBeInstanceOf(Uint8Array);

    expect(result.length).toBeGreaterThan(0);
  });

  it("encodes the message header", () => {
    const result = serializeSolanaTransactionMessage(createMessage());

    expect([...result.slice(0, 3)]).toEqual([1, 0, 1]);
  });

  it("encodes account key count", () => {
    const result = serializeSolanaTransactionMessage(createMessage());

    expect(result[3]).toBe(2);
  });

  it("encodes instruction count", () => {
    const result = serializeSolanaTransactionMessage(createMessage());

    /*
     * Header:
     *   3 bytes
     *
     * Account count:
     *   1 byte
     *
     * Account keys:
     *   64 bytes
     *
     * Recent blockhash:
     *   32 bytes
     *
     * Instruction count follows.
     */
    expect(result[100]).toBe(1);
  });

  it("serializes instruction program id index", () => {
    const result = serializeSolanaTransactionMessage(createMessage());

    expect(result[101]).toBe(1);
  });

  it("serializes empty instruction accounts", () => {
    const result = serializeSolanaTransactionMessage(createMessage());

    expect(result[102]).toBe(0);
  });

  it("serializes empty instruction data", () => {
    const result = serializeSolanaTransactionMessage(createMessage());

    expect(result[103]).toBe(0);
  });

  it("serializes instruction account indexes", () => {
    const result = serializeSolanaTransactionMessage(
      createMessage({
        instructions: [
          {
            programIdIndex: 1,
            accountIndexes: [0],
            data: new Uint8Array(),
          },
        ],
      }),
    );

    expect(result[102]).toBe(1);
    expect(result[103]).toBe(0);
  });

  it("serializes instruction data", () => {
    const result = serializeSolanaTransactionMessage(
      createMessage({
        instructions: [
          {
            programIdIndex: 1,
            accountIndexes: [],
            data: new Uint8Array([1, 2, 3]),
          },
        ],
      }),
    );

    expect(result[102]).toBe(0);
    expect(result[103]).toBe(3);
    expect([...result.slice(104, 107)]).toEqual([1, 2, 3]);
  });

  it("rejects an invalid public key", () => {
    expect(() =>
      serializeSolanaTransactionMessage(
        createMessage({
          accountKeys: [
            {
              address: "not-a-solana-address",
              isSigner: true,
              isWritable: true,
            },
          ],
        }),
      ),
    ).toThrow("Invalid Solana base58 value");
  });

  it("rejects a public key with invalid length", () => {
    expect(() =>
      serializeSolanaTransactionMessage(
        createMessage({
          accountKeys: [
            {
              address: "111",
              isSigner: true,
              isWritable: true,
            },
          ],
        }),
      ),
    ).toThrow("Solana public key must decode to 32 bytes");
  });

  it("rejects an invalid blockhash", () => {
    expect(() =>
      serializeSolanaTransactionMessage(
        createMessage({
          recentBlockhash: "invalid",
        }),
      ),
    ).toThrow();
  });

  it("returns deterministic bytes", () => {
    const message = createMessage();

    const first = serializeSolanaTransactionMessage(message);

    const second = serializeSolanaTransactionMessage(message);

    expect(first).toEqual(second);
  });

  it("does not mutate instruction data", () => {
    const data = new Uint8Array([10, 20, 30]);

    const message = createMessage({
      instructions: [
        {
          programIdIndex: 1,
          accountIndexes: [],
          data,
        },
      ],
    });

    const original = [...data];

    serializeSolanaTransactionMessage(message);

    expect([...data]).toEqual(original);
  });
});
