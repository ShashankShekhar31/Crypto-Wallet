import { describe, expect, it } from "vitest";

import { selectBitcoinUtxos } from "../coin-selection.js";

import type { BitcoinUtxo } from "../provider.js";

import { selectBitcoinUtxosWithFee } from "../coin-selection.js";

function createUtxo(value: bigint, txid: string, vout = 0): BitcoinUtxo {
  return Object.freeze({
    txid,
    vout,
    value,
    scriptPubKey: new Uint8Array([0x00, 0x14, 0xaa, 0xbb]),
    confirmations: 6,
  });
}

describe("selectBitcoinUtxos", () => {
  it("selects the largest UTXO first", () => {
    const utxos = [
      createUtxo(30_000n, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
      createUtxo(100_000n, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
      createUtxo(60_000n, "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"),
    ];

    const result = selectBitcoinUtxos(utxos, 70_000n);

    expect(result.selected).toHaveLength(1);

    expect(result.selected[0]?.value).toBe(100_000n);

    expect(result.totalValue).toBe(100_000n);

    expect(result.remainingValue).toBe(30_000n);
  });

  it("selects multiple UTXOs when necessary", () => {
    const utxos = [
      createUtxo(60_000n, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
      createUtxo(30_000n, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
      createUtxo(20_000n, "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"),
    ];

    const result = selectBitcoinUtxos(utxos, 90_000n);

    expect(result.selected).toHaveLength(2);

    expect(result.totalValue).toBe(90_000n);

    expect(result.remainingValue).toBe(0n);
  });

  it("does not mutate the input UTXO array", () => {
    const first = createUtxo(
      30_000n,
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );

    const second = createUtxo(
      100_000n,
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    );

    const utxos = [first, second];

    selectBitcoinUtxos(utxos, 50_000n);

    expect(utxos).toEqual([first, second]);
  });

  it("uses txid as a deterministic tie-breaker", () => {
    const first = createUtxo(
      50_000n,
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    );

    const second = createUtxo(
      50_000n,
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );

    const result = selectBitcoinUtxos([first, second], 50_000n);

    expect(result.selected[0]?.txid).toBe(
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
  });

  it("rejects insufficient funds", () => {
    const utxos = [
      createUtxo(20_000n, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
      createUtxo(30_000n, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
    ];

    expect(() => selectBitcoinUtxos(utxos, 60_000n)).toThrow("Insufficient Bitcoin funds");
  });

  it("rejects an empty UTXO set", () => {
    expect(() => selectBitcoinUtxos([], 50_000n)).toThrow("Bitcoin UTXO set cannot be empty");
  });

  it("rejects a non-positive target amount", () => {
    expect(() =>
      selectBitcoinUtxos(
        [createUtxo(50_000n, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")],
        0n,
      ),
    ).toThrow("Bitcoin target amount must be greater than zero");
  });

  it("rejects zero-value UTXOs", () => {
    expect(() =>
      selectBitcoinUtxos(
        [createUtxo(0n, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")],
        50_000n,
      ),
    ).toThrow("Bitcoin UTXO value must be greater than zero");
  });
});

describe("selectBitcoinUtxosWithFee", () => {
  it("selects enough UTXOs to cover amount and fee", () => {
    const utxos = [
      createUtxo(100_000n, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
    ];

    const result = selectBitcoinUtxosWithFee(utxos, 50_000n, "native-segwit", 2);

    expect(result.selected).toHaveLength(1);

    expect(result.totalValue).toBe(100_000n);

    expect(result.virtualSize).toBe(140);

    expect(result.fee).toBe(280n);

    expect(result.remainingValue).toBe(49_720n);
  });

  it("selects another UTXO when the first cannot cover the fee", () => {
    const utxos = [
      createUtxo(50_000n, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
      createUtxo(1_000n, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
    ];

    const result = selectBitcoinUtxosWithFee(utxos, 49_800n, "native-segwit", 2);

    expect(result.selected).toHaveLength(2);

    expect(result.totalValue).toBe(51_000n);

    expect(result.virtualSize).toBe(208);

    expect(result.fee).toBe(416n);

    expect(result.remainingValue).toBe(784n);
  });

  it("rejects insufficient funds including fees", () => {
    const utxos = [
      createUtxo(50_000n, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
    ];

    expect(() => selectBitcoinUtxosWithFee(utxos, 49_800n, "native-segwit", 2)).toThrow(
      "Insufficient Bitcoin funds",
    );
  });

  it("does not mutate the UTXO array", () => {
    const first = createUtxo(
      30_000n,
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );

    const second = createUtxo(
      100_000n,
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    );

    const utxos = [first, second];

    selectBitcoinUtxosWithFee(utxos, 50_000n, "native-segwit", 2);

    expect(utxos).toEqual([first, second]);
  });
});
