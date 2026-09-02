import { describe, expect, it } from "vitest";

import {
  calculateBitcoinFee,
  createBitcoinTransactionPlan,
  estimateBitcoinVirtualSize,
} from "../fee.js";

import type { BitcoinUtxo } from "../provider.js";

function createUtxo(value: bigint, vout = 0): BitcoinUtxo {
  return Object.freeze({
    txid: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    vout,
    value,
    scriptPubKey: new Uint8Array([0x00, 0x14, 0xaa, 0xbb]),
    confirmations: 6,
  });
}

describe("estimateBitcoinVirtualSize", () => {
  it("estimates a legacy transaction", () => {
    expect(estimateBitcoinVirtualSize(1, 2, "legacy")).toBe(226);
  });

  it("estimates a native SegWit transaction", () => {
    expect(estimateBitcoinVirtualSize(1, 2, "native-segwit")).toBe(140);
  });

  it("rejects an invalid input count", () => {
    expect(() => estimateBitcoinVirtualSize(0, 2, "legacy")).toThrow(
      "Bitcoin input count must be greater than zero",
    );
  });

  it("rejects an invalid output count", () => {
    expect(() => estimateBitcoinVirtualSize(1, 0, "legacy")).toThrow(
      "Bitcoin output count must be greater than zero",
    );
  });
});

describe("calculateBitcoinFee", () => {
  it("calculates a legacy transaction fee", () => {
    const result = calculateBitcoinFee(1, 2, "legacy", 10);

    expect(result.virtualSize).toBe(226);

    expect(result.satoshisPerVbyte).toBe(10);

    expect(result.fee).toBe(2260n);
  });

  it("calculates a native SegWit transaction fee", () => {
    const result = calculateBitcoinFee(2, 2, "native-segwit", 5);

    expect(result.virtualSize).toBe(208);

    expect(result.fee).toBe(1040n);
  });

  it("rounds fractional satoshis upward", () => {
    const result = calculateBitcoinFee(1, 2, "native-segwit", 1.5);

    expect(result.fee).toBe(210n);
  });

  it("rejects an invalid fee rate", () => {
    expect(() => calculateBitcoinFee(1, 2, "legacy", 0)).toThrow(
      "Bitcoin fee rate must be greater than zero",
    );
  });
});

describe("createBitcoinTransactionPlan", () => {
  it("creates a plan with change", () => {
    const utxos = [createUtxo(100000n)];

    const plan = createBitcoinTransactionPlan(utxos, 50000n, "native-segwit", 2);

    expect(plan.amount).toBe(50000n);

    expect(plan.fee).toBe(280n);

    expect(plan.change).toBe(49720n);

    expect(plan.inputs).toHaveLength(1);
  });

  it("uses all supplied UTXOs", () => {
    const utxos = [createUtxo(30000n, 0), createUtxo(40000n, 1)];

    const plan = createBitcoinTransactionPlan(utxos, 50000n, "native-segwit", 2);

    expect(plan.inputs).toHaveLength(2);

    expect(plan.change).toBe(19584n);
  });

  it("uses the full input value when no change is required", () => {
    const utxos = [createUtxo(50280n)];

    const plan = createBitcoinTransactionPlan(utxos, 50000n, "native-segwit", 2);

    expect(plan.change).toBe(0n);

    expect(plan.fee).toBe(280n);
  });

  it("rejects funds that cannot cover the estimated fee", () => {
    const utxos = [createUtxo(50001n)];

    expect(() => createBitcoinTransactionPlan(utxos, 50000n, "native-segwit", 2)).toThrow(
      "Insufficient Bitcoin funds",
    );
  });

  it("rejects insufficient funds", () => {
    const utxos = [createUtxo(50000n)];

    expect(() => createBitcoinTransactionPlan(utxos, 50000n, "native-segwit", 2)).toThrow(
      "Insufficient Bitcoin funds",
    );
  });

  it("rejects an empty UTXO set", () => {
    expect(() => createBitcoinTransactionPlan([], 50000n, "native-segwit", 2)).toThrow(
      "Bitcoin transaction requires at least one UTXO",
    );
  });

  it("rejects a non-positive amount", () => {
    expect(() =>
      createBitcoinTransactionPlan([createUtxo(100000n)], 0n, "native-segwit", 2),
    ).toThrow("Bitcoin transaction amount must be greater than zero");
  });
});
