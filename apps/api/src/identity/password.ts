import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

const SCRYPT_COST = 1 << 15;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;

const SALT_BYTES = 16;
const KEY_BYTES = 32;

const PASSWORD_HASH_VERSION = "scrypt-v1";

function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      keyLength,
      options,
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  validatePasswordInput(password);

  const salt = randomBytes(SALT_BYTES);

  const derivedKey = await scryptAsync(
    password,
    salt,
    KEY_BYTES,
    {
      N: SCRYPT_COST,
      r: SCRYPT_BLOCK_SIZE,
      p: SCRYPT_PARALLELIZATION,
      maxmem: SCRYPT_MAX_MEMORY,
    },
  );

  return [
    PASSWORD_HASH_VERSION,
    `n=${SCRYPT_COST},r=${SCRYPT_BLOCK_SIZE},p=${SCRYPT_PARALLELIZATION}`,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  validatePasswordInput(password);

  const parsed = parsePasswordHash(storedHash);

  const derivedKey = await scryptAsync(
    password,
    parsed.salt,
    parsed.keyLength,
    {
      N: parsed.cost,
      r: parsed.blockSize,
      p: parsed.parallelization,
      maxmem: SCRYPT_MAX_MEMORY,
    },
  );

  if (derivedKey.length !== parsed.hash.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, parsed.hash);
}

function validatePasswordInput(password: string): void {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Password must be a non-empty string");
  }
}

function parsePasswordHash(storedHash: string): {
  salt: Buffer;
  hash: Buffer;
  cost: number;
  blockSize: number;
  parallelization: number;
  keyLength: number;
} {
  const parts = storedHash.split("$");

  if (parts.length !== 4) {
    throw new Error("Invalid password hash format");
  }

  const version = parts[0];
  const parameters = parts[1];
  const saltEncoded = parts[2];
  const hashEncoded = parts[3];

  if (
    version === undefined ||
    parameters === undefined ||
    saltEncoded === undefined ||
    hashEncoded === undefined
  ) {
    throw new Error("Invalid password hash format");
  }

  if (version !== PASSWORD_HASH_VERSION) {
    throw new Error("Unsupported password hash version");
  }

  const parameterValues = new Map(
    parameters.split(",").map((parameter) => {
      const [key, value] = parameter.split("=");

      if (key === undefined || value === undefined) {
        throw new Error("Invalid password hash parameters");
      }

      const numericValue = Number(value);

      if (!Number.isSafeInteger(numericValue)) {
        throw new Error("Invalid password hash parameters");
      }

      return [key, numericValue] as const;
    }),
  );

  const cost = parameterValues.get("n");
  const blockSize = parameterValues.get("r");
  const parallelization = parameterValues.get("p");

  if (
    cost === undefined ||
    blockSize === undefined ||
    parallelization === undefined
  ) {
    throw new Error("Invalid password hash parameters");
  }

  if (
    cost !== SCRYPT_COST ||
    blockSize !== SCRYPT_BLOCK_SIZE ||
    parallelization !== SCRYPT_PARALLELIZATION
  ) {
    throw new Error("Unsupported password hash parameters");
  }

  const salt = Buffer.from(saltEncoded, "base64url");
  const hash = Buffer.from(hashEncoded, "base64url");

  if (salt.length !== SALT_BYTES || hash.length !== KEY_BYTES) {
    throw new Error("Invalid password hash length");
  }

  return {
    salt,
    hash,
    cost,
    blockSize,
    parallelization,
    keyLength: KEY_BYTES,
  };
}
