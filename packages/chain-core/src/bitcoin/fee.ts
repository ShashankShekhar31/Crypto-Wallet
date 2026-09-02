import type { BitcoinAddressType } from "./derivation.js";

import type { BitcoinUtxo } from "./provider.js";

export interface BitcoinFeeCalculation {
  readonly inputCount: number;
  readonly outputCount: number;
  readonly virtualSize: number;
  readonly satoshisPerVbyte: number;
  readonly fee: bigint;
}

export interface BitcoinTransactionPlan {
  readonly inputs: readonly BitcoinUtxo[];
  readonly amount: bigint;
  readonly fee: bigint;
  readonly change: bigint;
  readonly calculation: BitcoinFeeCalculation;
}

const P2PKH_INPUT_VBYTES = 148;
const P2WPKH_INPUT_VBYTES = 68;

const P2PKH_OUTPUT_VBYTES = 34;
const P2WPKH_OUTPUT_VBYTES = 31;

const TRANSACTION_OVERHEAD_VBYTES = 10;

function getInputVbytes(addressType: BitcoinAddressType): number {
  if (addressType === "legacy") {
    return P2PKH_INPUT_VBYTES;
  }

  return P2WPKH_INPUT_VBYTES;
}

function getOutputVbytes(addressType: BitcoinAddressType): number {
  if (addressType === "legacy") {
    return P2PKH_OUTPUT_VBYTES;
  }

  return P2WPKH_OUTPUT_VBYTES;
}

function validateFeeRate(satoshisPerVbyte: number): void {
  if (!Number.isFinite(satoshisPerVbyte) || satoshisPerVbyte <= 0) {
    throw new Error("Bitcoin fee rate must be greater than zero");
  }
}

function validateAmount(amount: bigint): void {
  if (typeof amount !== "bigint" || amount <= 0n) {
    throw new Error("Bitcoin transaction amount must be greater than zero");
  }
}

function validateUtxos(utxos: readonly BitcoinUtxo[]): void {
  if (utxos.length === 0) {
    throw new Error("Bitcoin transaction requires at least one UTXO");
  }

  for (const utxo of utxos) {
    if (typeof utxo.value !== "bigint" || utxo.value <= 0n) {
      throw new Error("Bitcoin UTXO value must be greater than zero");
    }
  }
}

export function estimateBitcoinVirtualSize(
  inputCount: number,
  outputCount: number,
  addressType: BitcoinAddressType,
): number {
  if (!Number.isInteger(inputCount) || inputCount <= 0) {
    throw new Error("Bitcoin input count must be greater than zero");
  }

  if (!Number.isInteger(outputCount) || outputCount <= 0) {
    throw new Error("Bitcoin output count must be greater than zero");
  }

  return (
    TRANSACTION_OVERHEAD_VBYTES +
    inputCount * getInputVbytes(addressType) +
    outputCount * getOutputVbytes(addressType)
  );
}

export function calculateBitcoinFee(
  inputCount: number,
  outputCount: number,
  addressType: BitcoinAddressType,
  satoshisPerVbyte: number,
): BitcoinFeeCalculation {
  validateFeeRate(satoshisPerVbyte);

  const virtualSize = estimateBitcoinVirtualSize(inputCount, outputCount, addressType);

  const fee = BigInt(Math.ceil(virtualSize * satoshisPerVbyte));

  return Object.freeze({
    inputCount,
    outputCount,
    virtualSize,
    satoshisPerVbyte,
    fee,
  });
}

export function createBitcoinTransactionPlan(
  utxos: readonly BitcoinUtxo[],
  amount: bigint,
  addressType: BitcoinAddressType,
  satoshisPerVbyte: number,
): BitcoinTransactionPlan {
  validateUtxos(utxos);
  validateAmount(amount);
  validateFeeRate(satoshisPerVbyte);

  const inputValue = utxos.reduce((total, utxo) => total + utxo.value, 0n);

  const feeWithChange = calculateBitcoinFee(utxos.length, 2, addressType, satoshisPerVbyte);

  const requiredWithChange = amount + feeWithChange.fee;

  if (inputValue < requiredWithChange) {
    const feeWithoutChange = calculateBitcoinFee(utxos.length, 1, addressType, satoshisPerVbyte);

    if (inputValue < amount + feeWithoutChange.fee) {
      throw new Error("Insufficient Bitcoin funds");
    }

    const change = 0n;

    return Object.freeze({
      inputs: Object.freeze([...utxos]),
      amount,
      fee: inputValue - amount,
      change,
      calculation: Object.freeze({
        ...feeWithoutChange,
        fee: inputValue - amount,
      }),
    });
  }

  const change = inputValue - amount - feeWithChange.fee;

  return Object.freeze({
    inputs: Object.freeze([...utxos]),
    amount,
    fee: feeWithChange.fee,
    change,
    calculation: feeWithChange,
  });
}
