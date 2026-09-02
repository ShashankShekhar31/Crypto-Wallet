import type { BitcoinTransaction } from "./transaction.js";

function encodeUint32LE(value: number): Uint8Array {
  const result = new Uint8Array(4);

  result[0] = value & 0xff;
  result[1] = (value >>> 8) & 0xff;
  result[2] = (value >>> 16) & 0xff;
  result[3] = (value >>> 24) & 0xff;

  return result;
}

function encodeUint64LE(value: bigint): Uint8Array {
  if (value < 0n || value > 0xffffffffffffffffn) {
    throw new Error("Bitcoin uint64 value is out of range");
  }

  const result = new Uint8Array(8);

  let remaining = value;

  for (let index = 0; index < 8; index += 1) {
    result[index] = Number(remaining & 0xffn);

    remaining >>= 8n;
  }

  return result;
}

function encodeCompactSize(value: number): Uint8Array {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Bitcoin compact size value must be a non-negative safe integer");
  }

  if (value < 0xfd) {
    return new Uint8Array([value]);
  }

  if (value <= 0xffff) {
    return new Uint8Array([0xfd, value & 0xff, (value >>> 8) & 0xff]);
  }

  if (value <= 0xffffffff) {
    return new Uint8Array([
      0xfe,
      value & 0xff,
      (value >>> 8) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 24) & 0xff,
    ]);
  }

  const result = new Uint8Array(9);

  result[0] = 0xff;

  let remaining = BigInt(value);

  for (let index = 0; index < 8; index += 1) {
    result[index + 1] = Number(remaining & 0xffn);

    remaining >>= 8n;
  }

  return result;
}

function concatBytes(...arrays: readonly Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((total, array) => total + array.length, 0);

  const result = new Uint8Array(totalLength);

  let offset = 0;

  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }

  return result;
}

function encodeHex(value: string): Uint8Array {
  const normalized = value.trim();

  if (normalized.length !== 64 || !/^[0-9a-fA-F]+$/.test(normalized)) {
    throw new Error("Invalid Bitcoin transaction id");
  }

  const result = new Uint8Array(32);

  for (let index = 0; index < 32; index += 1) {
    result[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
  }

  return result;
}

function serializeInput(input: BitcoinTransaction["inputs"][number]): Uint8Array {
  return concatBytes(
    // Bitcoin serializes the previous txid
    // in little-endian byte order.
    new Uint8Array([...encodeHex(input.previousTxid)].reverse()),

    encodeUint32LE(input.previousOutputIndex),

    encodeCompactSize(input.scriptSig.length),

    new Uint8Array(input.scriptSig),

    encodeUint32LE(input.sequence),
  );
}

function serializeOutput(output: BitcoinTransaction["outputs"][number]): Uint8Array {
  return concatBytes(
    encodeUint64LE(output.value),

    encodeCompactSize(output.scriptPubKey.length),

    new Uint8Array(output.scriptPubKey),
  );
}

export function serializeBitcoinTransaction(transaction: BitcoinTransaction): Uint8Array {
  const inputs = transaction.inputs.map(serializeInput);

  const outputs = transaction.outputs.map(serializeOutput);

  return concatBytes(
    encodeUint32LE(transaction.version),

    encodeCompactSize(inputs.length),

    ...inputs,

    encodeCompactSize(outputs.length),

    ...outputs,

    encodeUint32LE(transaction.lockTime),
  );
}
