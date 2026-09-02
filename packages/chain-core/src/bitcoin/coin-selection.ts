import type { BitcoinUtxo } from "./provider.js";

import { calculateBitcoinFee } from "./fee.js";

import type { BitcoinAddressType } from "./derivation.js";

export interface BitcoinCoinSelection {
  readonly selected: readonly BitcoinUtxo[];
  readonly totalValue: bigint;
  readonly remainingValue: bigint;
}

export interface BitcoinFeeAwareCoinSelection extends BitcoinCoinSelection {
  readonly fee: bigint;
  readonly virtualSize: number;
}

function validateAmount(amount: bigint): void {
  if (typeof amount !== "bigint" || amount <= 0n) {
    throw new Error("Bitcoin target amount must be greater than zero");
  }
}

function validateUtxos(utxos: readonly BitcoinUtxo[]): void {
  if (utxos.length === 0) {
    throw new Error("Bitcoin UTXO set cannot be empty");
  }

  for (const utxo of utxos) {
    if (typeof utxo.value !== "bigint" || utxo.value <= 0n) {
      throw new Error("Bitcoin UTXO value must be greater than zero");
    }
  }
}

export function selectBitcoinUtxos(
  utxos: readonly BitcoinUtxo[],
  targetAmount: bigint,
): BitcoinCoinSelection {
  validateAmount(targetAmount);
  validateUtxos(utxos);

  const sorted = [...utxos].sort((left, right) => {
    if (left.value === right.value) {
      return left.txid.localeCompare(right.txid);
    }

    return left.value > right.value ? -1 : 1;
  });

  const selected: BitcoinUtxo[] = [];

  let totalValue = 0n;

  for (const utxo of sorted) {
    selected.push(utxo);
    totalValue += utxo.value;

    if (totalValue >= targetAmount) {
      break;
    }
  }

  if (totalValue < targetAmount) {
    throw new Error("Insufficient Bitcoin funds");
  }

  return Object.freeze({
    selected: Object.freeze([...selected]),
    totalValue,
    remainingValue: totalValue - targetAmount,
  });
}

export function selectBitcoinUtxosWithFee(
  utxos: readonly BitcoinUtxo[],
  amount: bigint,
  addressType: BitcoinAddressType,
  satoshisPerVbyte: number,
): BitcoinFeeAwareCoinSelection {
  validateAmount(amount);
  validateUtxos(utxos);

  const sorted = [...utxos].sort((left, right) => {
    if (left.value === right.value) {
      return left.txid.localeCompare(right.txid);
    }

    return left.value > right.value ? -1 : 1;
  });

  const selected: BitcoinUtxo[] = [];
  let totalValue = 0n;

  for (const utxo of sorted) {
    selected.push(utxo);
    totalValue += utxo.value;

    const fee = calculateBitcoinFee(selected.length, 2, addressType, satoshisPerVbyte);

    if (totalValue >= amount + fee.fee) {
      return Object.freeze({
        selected: Object.freeze([...selected]),
        totalValue,
        remainingValue: totalValue - amount - fee.fee,
        fee: fee.fee,
        virtualSize: fee.virtualSize,
      });
    }
  }

  throw new Error("Insufficient Bitcoin funds");
}
