import { keccak_256 } from "@noble/hashes/sha3.js";

import type { EvmUnsignedTransaction } from "./transaction.js";

import type {
  EvmTransactionSignature,
} from "./signed-transaction.js";

export interface EvmTransactionSigner {
  signTransaction(
    transaction: EvmUnsignedTransaction,
  ): Promise<EvmTransactionSignature>;
}

function bigintToMinimalBytes(
  value: bigint,
): Uint8Array {
  if (value < 0n) {
    throw new Error("RLP quantity must be non-negative");
  }

  if (value === 0n) {
    return new Uint8Array();
  }

  const hex = value.toString(16);
  const normalized =
    hex.length % 2 === 0
      ? hex
      : `0${hex}`;

  const bytes = new Uint8Array(
    normalized.length / 2,
  );

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(
      normalized.slice(
        index * 2,
        index * 2 + 2,
      ),
      16,
    );
  }

  return bytes;
}

function hexToBytes(value: string): Uint8Array {
  if (!/^0x(?:[0-9a-fA-F]{2})*$/.test(value)) {
    throw new Error(
      "EVM transaction data must be even-length hexadecimal",
    );
  }

  const hex = value.slice(2);
  const bytes = new Uint8Array(hex.length / 2);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(
      hex.slice(index * 2, index * 2 + 2),
      16,
    );
  }

  return bytes;
}

function encodeRlpBytes(
  value: Uint8Array,
): Uint8Array {
  const length = value.length;

  if (length === 1 && value[0]! < 0x80) {
    return new Uint8Array(value);
  }

  if (length <= 55) {
    const result = new Uint8Array(
      1 + length,
    );

    result[0] = 0x80 + length;
    result.set(value, 1);

    return result;
  }

  const lengthBytes =
    bigintToMinimalBytes(BigInt(length));

  const result = new Uint8Array(
    1 + lengthBytes.length + length,
  );

  result[0] =
    0xb7 + lengthBytes.length;

  result.set(lengthBytes, 1);
  result.set(
    value,
    1 + lengthBytes.length,
  );

  return result;
}

function encodeRlpList(
  values: readonly Uint8Array[],
): Uint8Array {
  let payloadLength = 0;

  for (const value of values) {
    payloadLength += value.length;
  }

  if (payloadLength <= 55) {
    const result = new Uint8Array(
      1 + payloadLength,
    );

    result[0] = 0xc0 + payloadLength;

    let offset = 1;

    for (const value of values) {
      result.set(value, offset);
      offset += value.length;
    }

    return result;
  }

  const lengthBytes =
    bigintToMinimalBytes(BigInt(payloadLength));

  const result = new Uint8Array(
    1 +
      lengthBytes.length +
      payloadLength,
  );

  result[0] =
    0xf7 + lengthBytes.length;

  result.set(lengthBytes, 1);

  let offset = 1 + lengthBytes.length;

  for (const value of values) {
    result.set(value, offset);
    offset += value.length;
  }

  return result;
}

function encodeRlpQuantity(
  value: bigint,
): Uint8Array {
  return encodeRlpBytes(
    bigintToMinimalBytes(value),
  );
}

function encodeRlpAccessList(): Uint8Array {
  return encodeRlpList([]);
}

export function encodeEip1559SigningPayload(
  transaction: EvmUnsignedTransaction,
): Uint8Array {
  const to = hexToBytes(transaction.to);
  const data = hexToBytes(transaction.data);

  if (to.length !== 20) {
    throw new Error(
      "EVM transaction recipient must be 20 bytes",
    );
  }

  const accessList =
    encodeRlpAccessList();

  const encoded = encodeRlpList([
    encodeRlpQuantity(transaction.chainId),
    encodeRlpQuantity(transaction.nonce),
    encodeRlpQuantity(
      transaction.maxPriorityFeePerGas,
    ),
    encodeRlpQuantity(
      transaction.maxFeePerGas,
    ),
    encodeRlpQuantity(transaction.gasLimit),
    encodeRlpBytes(to),
    encodeRlpQuantity(transaction.value),
    encodeRlpBytes(data),
    accessList,
  ]);

  const result = new Uint8Array(
    1 + encoded.length,
  );

  result[0] = 0x02;
  result.set(encoded, 1);

  return result;
}

export function hashEip1559SigningPayload(
  transaction: EvmUnsignedTransaction,
): Uint8Array {
  return keccak_256(
    encodeEip1559SigningPayload(transaction),
  );
}

export function createEip1559SigningDigest(
  transaction: EvmUnsignedTransaction,
): Uint8Array {
  return hashEip1559SigningPayload(transaction);
}