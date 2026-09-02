import { describe, expect, it } from "vitest";

import { serializeBitcoinTransaction } from "../serializer.js";

import { createBitcoinTransaction } from "../transaction.js";

const TXID = "0000000000000000000123456789abcdef0123456789abcdef0123456789abcd";

function createTransaction() {
  return createBitcoinTransaction({
    network: "bitcoin-mainnet",
    version: 2,
    inputs: [
      {
        previousTxid: TXID,
        previousOutputIndex: 1,
        scriptSig: new Uint8Array([0x51, 0x52]),
        sequence: 0xffffffff,
        previousOutput: {
          value: 100000n,
          scriptPubKey: new Uint8Array([0x51]),
        },
      },
    ],
    outputs: [
      {
        value: 50_000n,
        scriptPubKey: new Uint8Array([0x51, 0x21]),
      },
    ],
    lockTime: 0,
  });
}

describe("serializeBitcoinTransaction", () => {
  it("serializes a transaction", () => {
    const result = serializeBitcoinTransaction(createTransaction());

    expect(result).toBeInstanceOf(Uint8Array);

    expect(result.length).toBeGreaterThan(0);
  });

  it("serializes the version in little-endian", () => {
    const result = serializeBitcoinTransaction(createTransaction());

    expect([...result.slice(0, 4)]).toEqual([0x02, 0x00, 0x00, 0x00]);
  });

  it("serializes the input count", () => {
    const result = serializeBitcoinTransaction(createTransaction());

    expect(result[4]).toBe(1);
  });

  it("serializes the previous transaction id reversed", () => {
    const result = serializeBitcoinTransaction(createTransaction());

    expect([...result.slice(5, 37)]).toEqual([
      ...new Uint8Array([...TXID.match(/../g)!].map((byte) => Number.parseInt(byte, 16))).reverse(),
    ]);
  });

  it("serializes the previous output index", () => {
    const result = serializeBitcoinTransaction(createTransaction());

    expect([...result.slice(37, 41)]).toEqual([0x01, 0x00, 0x00, 0x00]);
  });

  it("serializes scriptSig length and bytes", () => {
    const result = serializeBitcoinTransaction(createTransaction());

    expect(result[41]).toBe(2);

    expect([...result.slice(42, 44)]).toEqual([0x51, 0x52]);
  });

  it("serializes sequence", () => {
    const result = serializeBitcoinTransaction(createTransaction());

    expect([...result.slice(44, 48)]).toEqual([0xff, 0xff, 0xff, 0xff]);
  });

  it("serializes output count", () => {
    const result = serializeBitcoinTransaction(createTransaction());

    expect(result[48]).toBe(1);
  });

  it("serializes output value as uint64 little-endian", () => {
    const result = serializeBitcoinTransaction(createTransaction());

    expect([...result.slice(49, 57)]).toEqual([0x50, 0xc3, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  });

  it("serializes scriptPubKey length and bytes", () => {
    const result = serializeBitcoinTransaction(createTransaction());

    expect(result[57]).toBe(2);

    expect([...result.slice(58, 60)]).toEqual([0x51, 0x21]);
  });

  it("serializes locktime", () => {
    const result = serializeBitcoinTransaction(createTransaction());

    expect([...result.slice(-4)]).toEqual([0x00, 0x00, 0x00, 0x00]);
  });

  it("produces deterministic bytes", () => {
    const transaction = createTransaction();

    const first = serializeBitcoinTransaction(transaction);

    const second = serializeBitcoinTransaction(transaction);

    expect(first).toEqual(second);
  });

  it("does not mutate transaction scripts", () => {
    const scriptSig = new Uint8Array([10, 20, 30]);

    const transaction = createBitcoinTransaction({
      network: "bitcoin-mainnet",
      version: 2,
      inputs: [
        {
          previousTxid: TXID,
          previousOutputIndex: 0,
          scriptSig,
          sequence: 0xffffffff,
          previousOutput: {
            value: 100000n,
            scriptPubKey: new Uint8Array([0x51]),
          },
        },
      ],
      outputs: [
        {
          value: 1n,
          scriptPubKey: new Uint8Array(),
        },
      ],
      lockTime: 0,
    });

    const original = [...scriptSig];

    serializeBitcoinTransaction(transaction);

    expect([...scriptSig]).toEqual(original);
  });
});
