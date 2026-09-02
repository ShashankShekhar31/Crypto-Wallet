import { sha256 } from "@noble/hashes/sha2.js";

import { serializeBitcoinTransaction } from "./serializer.js";

import type { BitcoinTransaction } from "./transaction.js";

export const BITCOIN_SIGHASH_ALL = 0x01;

function cloneBytes(value: Uint8Array): Uint8Array {
  return new Uint8Array(value);
}

function uint32ToLittleEndian(value: number): Uint8Array {
  const result = new Uint8Array(4);

  const view = new DataView(result.buffer);

  view.setUint32(0, value >>> 0, true);

  return result;
}

function concatBytes(...parts: readonly Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((total, part) => total + part.length, 0);

  const result = new Uint8Array(totalLength);

  let offset = 0;

  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
}

function doubleSha256(value: Uint8Array): Uint8Array {
  return sha256(sha256(value));
}

export function createBitcoinLegacySigningDigest(
  transaction: BitcoinTransaction,
  inputIndex: number,
): Uint8Array {
  if (!Number.isInteger(inputIndex) || inputIndex < 0 || inputIndex >= transaction.inputs.length) {
    throw new Error("Bitcoin signing input index is out of range");
  }

  const signingInputs = transaction.inputs.map((input, index) => ({
    ...input,
    scriptSig:
      index === inputIndex ? cloneBytes(input.previousOutput.scriptPubKey) : new Uint8Array(),
  }));

  const signingTransaction: BitcoinTransaction = {
    ...transaction,
    inputs: signingInputs,
  };

  const serialized = serializeBitcoinTransaction(signingTransaction);

  const sighashType = uint32ToLittleEndian(BITCOIN_SIGHASH_ALL);

  return doubleSha256(concatBytes(serialized, sighashType));
}
