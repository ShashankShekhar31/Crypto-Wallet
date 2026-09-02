import { calculateBitcoinFee } from "./fee.js";

import { createBitcoinTransaction } from "./transaction.js";

import type { BitcoinAddressType } from "./derivation.js";

import type { BitcoinUtxo } from "./provider.js";

import type { BitcoinNetworkId } from "./types.js";

import type { BitcoinTransaction } from "./transaction.js";

export interface BitcoinTransactionBuildRequest {
  readonly network: BitcoinNetworkId;
  readonly inputs: readonly BitcoinUtxo[];
  readonly amount: bigint;
  readonly recipientScriptPubKey: Uint8Array;
  readonly changeScriptPubKey: Uint8Array;
  readonly addressType: BitcoinAddressType;
  readonly satoshisPerVbyte: number;
}

export interface BitcoinTransactionBuildResult {
  readonly transaction: BitcoinTransaction;
  readonly fee: bigint;
  readonly change: bigint;
  readonly virtualSize: number;
}

const DEFAULT_SEQUENCE = 0xffffffff;

function cloneBytes(value: Uint8Array): Uint8Array {
  return new Uint8Array(value);
}

function validateAmount(amount: bigint): void {
  if (typeof amount !== "bigint" || amount <= 0n) {
    throw new Error("Bitcoin transaction amount must be greater than zero");
  }
}

function validateFeeRate(satoshisPerVbyte: number): void {
  if (!Number.isFinite(satoshisPerVbyte) || satoshisPerVbyte <= 0) {
    throw new Error("Bitcoin fee rate must be greater than zero");
  }
}

function validateInputs(inputs: readonly BitcoinUtxo[]): void {
  if (inputs.length === 0) {
    throw new Error("Bitcoin transaction requires at least one input");
  }
}

function validateScript(script: Uint8Array, field: string): void {
  if (!(script instanceof Uint8Array)) {
    throw new Error(`Bitcoin ${field} must be a Uint8Array`);
  }

  if (script.length === 0) {
    throw new Error(`Bitcoin ${field} cannot be empty`);
  }
}

export function buildBitcoinTransaction(
  request: BitcoinTransactionBuildRequest,
): BitcoinTransactionBuildResult {
  validateAmount(request.amount);

  validateFeeRate(request.satoshisPerVbyte);

  validateInputs(request.inputs);

  validateScript(request.recipientScriptPubKey, "recipient scriptPubKey");

  const totalInputValue = request.inputs.reduce((total, input) => total + input.value, 0n);

  const feeEstimate = calculateBitcoinFee(
    request.inputs.length,
    2,
    request.addressType,
    request.satoshisPerVbyte,
  );

  const required = request.amount + feeEstimate.fee;

  if (totalInputValue < required) {
    throw new Error("Insufficient Bitcoin funds");
  }

  const change = totalInputValue - request.amount - feeEstimate.fee;

  const transactionInputs = request.inputs.map((input) =>
    Object.freeze({
      previousTxid: input.txid,
      previousOutputIndex: input.vout,
      scriptSig: new Uint8Array(),
      sequence: DEFAULT_SEQUENCE,
      previousOutput: Object.freeze({
        value: input.value,
        scriptPubKey: cloneBytes(input.scriptPubKey),
      }),
    }),
  );

  const outputs = [
    {
      value: request.amount,
      scriptPubKey: cloneBytes(request.recipientScriptPubKey),
    },
  ];

  if (change > 0n) {
    outputs.push({
      value: change,
      scriptPubKey: cloneBytes(request.changeScriptPubKey),
    });
  }

  const transaction = createBitcoinTransaction({
    network: request.network,
    version: 2,
    inputs: transactionInputs,
    outputs,
    lockTime: 0,
  });

  return Object.freeze({
    transaction,
    fee: totalInputValue - request.amount - change,
    change,
    virtualSize: feeEstimate.virtualSize,
  });
}
