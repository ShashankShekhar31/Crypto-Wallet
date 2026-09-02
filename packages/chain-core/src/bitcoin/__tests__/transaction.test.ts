import { describe, expect, it } from "vitest";

import { createBitcoinTransaction } from "../transaction.js";

const TXID = "0000000000000000000123456789abcdef0123456789abcdef0123456789abcd";

function createTransaction() {
  return createBitcoinTransaction({
    network: "bitcoin-mainnet",
    version: 2,
    inputs: [
      {
        previousTxid: TXID,
        previousOutputIndex: 0,
        scriptSig: new Uint8Array([1, 2, 3]),
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
        scriptPubKey: new Uint8Array([0x51]),
      },
    ],
    lockTime: 0,
  });
}

describe("Bitcoin transaction", () => {
  it("creates a transaction", () => {
    const result = createTransaction();

    expect(result.network).toBe("bitcoin-mainnet");

    expect(result.version).toBe(2);

    expect(result.inputs.length).toBe(1);

    expect(result.outputs.length).toBe(1);

    expect(result.outputs[0]?.value).toBe(50_000n);
  });

  it("preserves transaction input fields", () => {
    const result = createTransaction();

    expect(result.inputs[0]?.previousTxid).toBe(TXID);

    expect(result.inputs[0]?.previousOutputIndex).toBe(0);

    expect(result.inputs[0]?.sequence).toBe(0xffffffff);
  });

  it("preserves transaction output script", () => {
    const result = createTransaction();

    expect([...(result.outputs[0]?.scriptPubKey ?? [])]).toEqual([0x51]);
  });

  it("rejects a transaction without inputs", () => {
    expect(() =>
      createBitcoinTransaction({
        network: "bitcoin-mainnet",
        version: 2,
        inputs: [],
        outputs: [
          {
            value: 1n,
            scriptPubKey: new Uint8Array(),
          },
        ],
        lockTime: 0,
      }),
    ).toThrow("Bitcoin transaction requires at least one input");
  });

  it("rejects a transaction without outputs", () => {
    expect(() =>
      createBitcoinTransaction({
        network: "bitcoin-mainnet",
        version: 2,
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
        outputs: [],
        lockTime: 0,
      }),
    ).toThrow("Bitcoin transaction requires at least one output");
  });

  it("rejects an invalid previous transaction id", () => {
    expect(() =>
      createBitcoinTransaction({
        network: "bitcoin-mainnet",
        version: 2,
        inputs: [
          {
            previousTxid: "invalid",
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
            value: 1n,
            scriptPubKey: new Uint8Array(),
          },
        ],
        lockTime: 0,
      }),
    ).toThrow("Invalid Bitcoin previous transaction id");
  });

  it("rejects an invalid output index", () => {
    expect(() =>
      createBitcoinTransaction({
        network: "bitcoin-mainnet",
        version: 2,
        inputs: [
          {
            previousTxid: TXID,
            previousOutputIndex: -1,
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
            value: 1n,
            scriptPubKey: new Uint8Array(),
          },
        ],
        lockTime: 0,
      }),
    ).toThrow("Bitcoin previous output index must be a uint32");
  });

  it("rejects a negative output value", () => {
    expect(() =>
      createBitcoinTransaction({
        network: "bitcoin-mainnet",
        version: 2,
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
            value: -1n,
            scriptPubKey: new Uint8Array(),
          },
        ],
        lockTime: 0,
      }),
    ).toThrow("Bitcoin transaction output value must be a non-negative bigint");
  });

  it("returns an immutable transaction", () => {
    const result = createTransaction();

    expect(Object.isFrozen(result)).toBe(true);

    expect(Object.isFrozen(result.inputs)).toBe(true);

    expect(Object.isFrozen(result.outputs)).toBe(true);
  });

  it("does not mutate input byte arrays", () => {
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

    scriptSig[0] = 99;

    expect(transaction.inputs[0]?.scriptSig[0]).toBe(10);
  });
  it("does not mutate previous output bytes", () => {
    const scriptPubKey = new Uint8Array([0x51]);

    const transaction = createBitcoinTransaction({
      network: "bitcoin-mainnet",
      version: 1,
      inputs: [
        {
          previousTxid: "0000000000000000000000000000000000000000000000000000000000000001",
          previousOutputIndex: 0,
          scriptSig: new Uint8Array(),
          sequence: 0xffffffff,
          previousOutput: {
            value: 100000n,
            scriptPubKey,
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

    scriptPubKey[0] = 0x00;

    expect(transaction.inputs[0].previousOutput.scriptPubKey[0]).toBe(0x51);
  });
});
