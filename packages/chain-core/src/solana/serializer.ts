import type {
  SolanaCompiledInstruction,
  SolanaTransactionMessage,
} from "./message.js";

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const BASE58_MAP = new Map(
  [...BASE58_ALPHABET].map(
    (character, index) => [
      character,
      index,
    ],
  ),
);

function decodeBase58(
  value: string,
): Uint8Array {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(
      "Solana base58 value is required",
    );
  }

  const bytes: number[] = [];

  for (const character of normalized) {
    const digit =
      BASE58_MAP.get(character);

    if (digit === undefined) {
      throw new Error(
        "Invalid Solana base58 value",
      );
    }

    let carry = digit;

    for (
      let index = 0;
      index < bytes.length;
      index += 1
    ) {
      const current =
        bytes[index];

      if (current === undefined) {
        throw new Error(
          "Invalid Solana base58 value",
        );
      }

      const value =
        current * 58 + carry;

      bytes[index] =
        value & 0xff;

      carry =
        Math.floor(value / 256);
    }

    while (carry > 0) {
      bytes.push(
        carry & 0xff,
      );

      carry =
        Math.floor(carry / 256);
    }
  }

  let leadingZeroes = 0;

  for (
    let index = 0;
    index < normalized.length;
    index += 1
  ) {
    if (
      normalized[index] !== "1"
    ) {
      break;
    }

    leadingZeroes += 1;
  }

  const result =
    new Uint8Array(
      leadingZeroes +
        bytes.length,
    );

  for (
    let index = 0;
    index < bytes.length;
    index += 1
  ) {
    const value =
      bytes[index];

    if (value === undefined) {
      throw new Error(
        "Invalid Solana base58 value",
      );
    }

    result[
      result.length - 1 - index
    ] = value;
  }

  return result;
}

function decodePublicKey(
  value: string,
): Uint8Array {
  const decoded =
    decodeBase58(value);

  if (decoded.length !== 32) {
    throw new Error(
      "Solana public key must decode to 32 bytes",
    );
  }

  return decoded;
}

function decodeBlockhash(
  value: string,
): Uint8Array {
  const decoded =
    decodeBase58(value);

  if (decoded.length !== 32) {
    throw new Error(
      "Solana recent blockhash must decode to 32 bytes",
    );
  }

  return decoded;
}

function encodeShortVec(
  value: number,
): Uint8Array {
  if (
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(
      "Solana short vector length must be a non-negative safe integer",
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

function encodeU8(
  value: number,
): Uint8Array {
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > 255
  ) {
    throw new Error(
      "Solana u8 value is out of range",
    );
  }

  return new Uint8Array([value]);
}

function serializeInstruction(
  instruction: SolanaCompiledInstruction,
): Uint8Array {
  if (
    !Number.isInteger(
      instruction.programIdIndex,
    ) ||
    instruction.programIdIndex < 0 ||
    instruction.programIdIndex > 255
  ) {
    throw new Error(
      "Solana instruction program id index is out of range",
    );
  }

  const accountIndexes =
    new Uint8Array(
      instruction.accountIndexes.length,
    );

  for (
    let index = 0;
    index < instruction.accountIndexes.length;
    index += 1
  ) {
    const accountIndex =
      instruction.accountIndexes[index];

    if (
      accountIndex === undefined ||
      !Number.isInteger(accountIndex) ||
      accountIndex < 0 ||
      accountIndex > 255
    ) {
      throw new Error(
        "Solana instruction account index is out of range",
      );
    }

    accountIndexes[index] =
      accountIndex;
  }

  const data =
    new Uint8Array(
      instruction.data,
    );

  return concatBytes(
    encodeU8(
      instruction.programIdIndex,
    ),
    encodeShortVec(
      accountIndexes.length,
    ),
    accountIndexes,
    encodeShortVec(
      data.length,
    ),
    data,
  );
}

function countRequiredSignatures(
  message: SolanaTransactionMessage,
): number {
  return message.accountKeys.filter(
    (account) =>
      account.isSigner,
  ).length;
}

function countReadonlySignedAccounts(
  message: SolanaTransactionMessage,
): number {
  return message.accountKeys.filter(
    (account) =>
      account.isSigner &&
      !account.isWritable,
  ).length;
}

function countReadonlyUnsignedAccounts(
  message: SolanaTransactionMessage,
): number {
  return message.accountKeys.filter(
    (account) =>
      !account.isSigner &&
      !account.isWritable,
  ).length;
}

export function serializeSolanaTransactionMessage(
  message: SolanaTransactionMessage,
): Uint8Array {
  if (
    message.accountKeys.length === 0
  ) {
    throw new Error(
      "Solana transaction message requires account keys",
    );
  }

  if (
    message.instructions.length === 0
  ) {
    throw new Error(
      "Solana transaction message requires instructions",
    );
  }

  const requiredSignatures =
    countRequiredSignatures(
      message,
    );

  const readonlySignedAccounts =
    countReadonlySignedAccounts(
      message,
    );

  const readonlyUnsignedAccounts =
    countReadonlyUnsignedAccounts(
      message,
    );

  if (
    requiredSignatures > 255 ||
    readonlySignedAccounts > 255 ||
    readonlyUnsignedAccounts > 255
  ) {
    throw new Error(
      "Solana transaction message account count exceeds u8 range",
    );
  }

  const accountKeys =
    message.accountKeys.map(
      (account) =>
        decodePublicKey(
          account.address,
        ),
    );

  const recentBlockhash =
    decodeBlockhash(
      message.recentBlockhash,
    );

  const instructions =
    message.instructions.map(
      serializeInstruction,
    );

  return concatBytes(
    encodeU8(requiredSignatures),
    encodeU8(readonlySignedAccounts),
    encodeU8(readonlyUnsignedAccounts),

    encodeShortVec(
      accountKeys.length,
    ),

    ...accountKeys,

    recentBlockhash,

    encodeShortVec(
      instructions.length,
    ),

    ...instructions,
  );
}