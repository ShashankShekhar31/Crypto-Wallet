import { describe, expect, it } from "vitest";

import { BITCOIN_SIGHASH_ALL, createBitcoinLegacySigningDigest } from "../signing.js";

import { createBitcoinTransaction } from "../transaction.js";

const TXID = "0000000000000000000000000000000000000000000000000000000000000001";

function createTransaction() {
  return createBitcoinTransaction({
    network: "bitcoin-mainnet",
    version: 1,
    inputs: [
      {
        previousTxid: TXID,
        previousOutputIndex: 0,
        scriptSig: new Uint8Array(),
        sequence: 0xffffffff,
        previousOutput: {
          value: 100000n,
          scriptPubKey: new Uint8Array([0x51]),
        },
      },
    ],
    outputs: [
      {
        value: 90000n,
        scriptPubKey: new Uint8Array([0x51]),
      },
    ],
    lockTime: 0,
  });
}

describe("Bitcoin legacy signing", () => {
  it("uses SIGHASH_ALL", () => {
    expect(BITCOIN_SIGHASH_ALL).toBe(0x01);
  });

  it("creates a 32-byte signing digest", () => {
    const digest = createBitcoinLegacySigningDigest(createTransaction(), 0);

    expect(digest).toBeInstanceOf(Uint8Array);

    expect(digest.length).toBe(32);
  });

  it("returns deterministic digest bytes", () => {
    const transaction = createTransaction();

    const first = createBitcoinLegacySigningDigest(transaction, 0);

    const second = createBitcoinLegacySigningDigest(transaction, 0);

    expect(first).toEqual(second);
  });

  it("rejects an invalid input index", () => {
    expect(() => createBitcoinLegacySigningDigest(createTransaction(), 1)).toThrow(
      "Bitcoin signing input index is out of range",
    );
  });

  it("does not mutate the transaction", () => {
    const transaction = createTransaction();

    const originalScript = [...transaction.inputs[0].scriptSig];

    createBitcoinLegacySigningDigest(transaction, 0);

    expect([...transaction.inputs[0].scriptSig]).toEqual(originalScript);
  });
});
