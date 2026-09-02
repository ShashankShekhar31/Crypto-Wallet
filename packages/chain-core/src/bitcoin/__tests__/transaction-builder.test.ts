import { describe, expect, it } from "vitest";

import { buildBitcoinTransaction } from "../transaction-builder.js";

import type { BitcoinUtxo } from "../provider.js";

function createUtxo(value: bigint, vout = 0): BitcoinUtxo {
  return Object.freeze({
    txid: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    vout,
    value,
    scriptPubKey: Uint8Array.from([0x00, 0x14, 0xaa, 0xbb]),
    confirmations: 6,
  });
}

const RECIPIENT_SCRIPT = Uint8Array.from([
  0x00, 0x14, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee,
  0xff, 0x00, 0x11, 0x22, 0x33, 0x44,
]);

const CHANGE_SCRIPT = Uint8Array.from([
  0x00, 0x14, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
  0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd,
]);

describe("buildBitcoinTransaction", () => {
  it("builds an unsigned native SegWit transaction", () => {
    const result = buildBitcoinTransaction({
      network: "bitcoin-mainnet",
      inputs: [createUtxo(100_000n)],
      amount: 50_000n,
      recipientScriptPubKey: RECIPIENT_SCRIPT,
      changeScriptPubKey: CHANGE_SCRIPT,
      addressType: "native-segwit",
      satoshisPerVbyte: 2,
    });

    expect(result.transaction.network).toBe("bitcoin-mainnet");

    expect(result.transaction.version).toBe(2);

    expect(result.transaction.inputs).toHaveLength(1);

    expect(result.transaction.outputs).toHaveLength(2);

    expect(result.transaction.outputs[0]?.value).toBe(50_000n);

    expect(result.transaction.outputs[1]?.value).toBe(49_720n);

    expect(result.fee).toBe(280n);

    expect(result.change).toBe(49_720n);

    expect(result.virtualSize).toBe(140);
  });

  it("preserves the UTXO outpoint and previous output", () => {
    const txid = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

    const utxo = Object.freeze({
      ...createUtxo(100_000n, 3),
      txid,
    });

    const result = buildBitcoinTransaction({
      network: "bitcoin-testnet",
      inputs: [utxo],
      amount: 50_000n,
      recipientScriptPubKey: RECIPIENT_SCRIPT,
      changeScriptPubKey: CHANGE_SCRIPT,
      addressType: "native-segwit",
      satoshisPerVbyte: 2,
    });

    const input = result.transaction.inputs[0];

    expect(input?.previousTxid).toBe(txid);

    expect(input?.previousOutputIndex).toBe(3);

    expect(input?.previousOutput.value).toBe(100_000n);

    expect(input?.scriptSig).toEqual(new Uint8Array());

    expect(input?.sequence).toBe(0xffffffff);
  });

  it("creates only the recipient output when change is zero", () => {
    const result = buildBitcoinTransaction({
      network: "bitcoin-mainnet",
      inputs: [createUtxo(50_280n)],
      amount: 50_000n,
      recipientScriptPubKey: RECIPIENT_SCRIPT,
      changeScriptPubKey: CHANGE_SCRIPT,
      addressType: "native-segwit",
      satoshisPerVbyte: 2,
    });

    expect(result.transaction.outputs).toHaveLength(1);

    expect(result.change).toBe(0n);

    expect(result.fee).toBe(280n);
  });

  it("rejects insufficient funds", () => {
    expect(() =>
      buildBitcoinTransaction({
        network: "bitcoin-mainnet",
        inputs: [createUtxo(50_000n)],
        amount: 50_000n,
        recipientScriptPubKey: RECIPIENT_SCRIPT,
        changeScriptPubKey: CHANGE_SCRIPT,
        addressType: "native-segwit",
        satoshisPerVbyte: 2,
      }),
    ).toThrow("Insufficient Bitcoin funds");
  });

  it("rejects an empty recipient script", () => {
    expect(() =>
      buildBitcoinTransaction({
        network: "bitcoin-mainnet",
        inputs: [createUtxo(100_000n)],
        amount: 50_000n,
        recipientScriptPubKey: new Uint8Array(),
        changeScriptPubKey: CHANGE_SCRIPT,
        addressType: "native-segwit",
        satoshisPerVbyte: 2,
      }),
    ).toThrow("Bitcoin recipient scriptPubKey cannot be empty");
  });

  it("does not mutate supplied scripts", () => {
    const recipient = new Uint8Array(RECIPIENT_SCRIPT);

    const change = new Uint8Array(CHANGE_SCRIPT);

    buildBitcoinTransaction({
      network: "bitcoin-mainnet",
      inputs: [createUtxo(100_000n)],
      amount: 50_000n,
      recipientScriptPubKey: recipient,
      changeScriptPubKey: change,
      addressType: "native-segwit",
      satoshisPerVbyte: 2,
    });

    expect(recipient).toEqual(RECIPIENT_SCRIPT);

    expect(change).toEqual(CHANGE_SCRIPT);
  });
});
