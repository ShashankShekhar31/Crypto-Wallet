import type {
  SolanaTransactionMessage,
} from "./message.js";

import {
  serializeSolanaTransactionMessage,
} from "./serializer.js";

export interface SolanaSignedTransaction {
  readonly signatures: readonly Uint8Array[];
  readonly message: Uint8Array;
}

function encodeShortVec(
  value: number,
): Uint8Array {
  if (
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(
      "Solana signature count must be a non-negative safe integer",
    );
  }

  const bytes: number[] = [];
  let remaining = value;

  do {
    let encoded =
      remaining & 0x7f;

    remaining =
      Math.floor(
        remaining / 128,
      );

    if (remaining !== 0) {
      encoded |= 0x80;
    }

    bytes.push(encoded);
  } while (remaining !== 0);

  return new Uint8Array(bytes);
}

function concatBytes(
  ...arrays: readonly Uint8Array[]
): Uint8Array {
  const totalLength =
    arrays.reduce(
      (total, array) =>
        total + array.length,
      0,
    );

  const result =
    new Uint8Array(totalLength);

  let offset = 0;

  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }

  return result;
}

function validateSignature(
  signature: Uint8Array,
): Uint8Array {
  if (
    !(signature instanceof Uint8Array)
  ) {
    throw new Error(
      "Invalid Solana transaction signature",
    );
  }

  if (signature.length !== 64) {
    throw new Error(
      "Solana transaction signature must be 64 bytes",
    );
  }

  return new Uint8Array(signature);
}

export function createSolanaSignedTransaction(
  message: SolanaTransactionMessage,
  signatures: readonly Uint8Array[],
): SolanaSignedTransaction {
  const serializedMessage =
    serializeSolanaTransactionMessage(
      message,
    );

  const requiredSignatures =
    message.accountKeys.filter(
      (account) =>
        account.isSigner,
    ).length;

  if (
    signatures.length !==
    requiredSignatures
  ) {
    throw new Error(
      "Solana transaction signature count does not match required signatures",
    );
  }

  const normalizedSignatures =
    signatures.map(
      validateSignature,
    );

  return Object.freeze({
    signatures: Object.freeze([
      ...normalizedSignatures,
    ]),
    message: new Uint8Array(
      serializedMessage,
    ),
  });
}

export function serializeSolanaSignedTransaction(
  transaction: SolanaSignedTransaction,
): Uint8Array {
  const signatures =
    transaction.signatures.map(
      validateSignature,
    );

  if (signatures.length > 255) {
    throw new Error(
      "Solana transaction signature count exceeds u8 range",
    );
  }

  const message =
    new Uint8Array(
      transaction.message,
    );

  return concatBytes(
    encodeShortVec(
      signatures.length,
    ),
    ...signatures,
    message,
  );
}