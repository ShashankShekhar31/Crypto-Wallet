import type { BitcoinNetworkId } from "./types.js";

export interface BitcoinPreviousOutput {
  readonly value: bigint;
  readonly scriptPubKey: Uint8Array;
}

export interface BitcoinTransactionInput {
  readonly previousTxid: string;
  readonly previousOutputIndex: number;
  readonly scriptSig: Uint8Array;
  readonly sequence: number;
  readonly previousOutput: BitcoinPreviousOutput;
}

export interface BitcoinTransactionOutput {
  readonly value: bigint;
  readonly scriptPubKey: Uint8Array;
}

export interface BitcoinTransaction {
  readonly network: BitcoinNetworkId;
  readonly version: number;
  readonly inputs: readonly BitcoinTransactionInput[];
  readonly outputs: readonly BitcoinTransactionOutput[];
  readonly lockTime: number;
}

function cloneBytes(value: Uint8Array): Uint8Array {
  return new Uint8Array(value);
}

function validateUint32(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`Bitcoin ${field} must be a uint32`);
  }
}

function validateInt32(value: number, field: string): void {
  if (!Number.isInteger(value) || value < -0x80000000 || value > 0x7fffffff) {
    throw new Error(`Bitcoin ${field} must be an int32`);
  }
}

function validatePreviousTxid(value: string): string {
  const normalized = value.trim();

  if (normalized.length !== 64 || !/^[0-9a-fA-F]+$/.test(normalized)) {
    throw new Error("Invalid Bitcoin previous transaction id");
  }

  return normalized;
}

export function createBitcoinTransaction(transaction: BitcoinTransaction): BitcoinTransaction {
  validateInt32(transaction.version, "transaction version");

  if (transaction.inputs.length === 0) {
    throw new Error("Bitcoin transaction requires at least one input");
  }

  if (transaction.outputs.length === 0) {
    throw new Error("Bitcoin transaction requires at least one output");
  }

  validateUint32(transaction.lockTime, "transaction locktime");

  const inputs = transaction.inputs.map((input) => {
    const previousTxid = validatePreviousTxid(input.previousTxid);

    validateUint32(input.previousOutputIndex, "previous output index");

    validateUint32(input.sequence, "input sequence");

    if (typeof input.previousOutput.value !== "bigint" || input.previousOutput.value < 0n) {
      throw new Error("Bitcoin previous output value must be a non-negative bigint");
    }

    const previousOutput = Object.freeze({
      value: input.previousOutput.value,
      scriptPubKey: cloneBytes(input.previousOutput.scriptPubKey),
    });

    return Object.freeze({
      previousTxid,
      previousOutputIndex: input.previousOutputIndex,
      scriptSig: cloneBytes(input.scriptSig),
      sequence: input.sequence,
      previousOutput,
    });
  });

  const outputs = transaction.outputs.map((output) => {
    if (typeof output.value !== "bigint" || output.value < 0n) {
      throw new Error("Bitcoin transaction output value must be a non-negative bigint");
    }

    return Object.freeze({
      value: output.value,
      scriptPubKey: cloneBytes(output.scriptPubKey),
    });
  });

  return Object.freeze({
    network: transaction.network,
    version: transaction.version,
    inputs: Object.freeze(inputs),
    outputs: Object.freeze(outputs),
    lockTime: transaction.lockTime,
  });
}
