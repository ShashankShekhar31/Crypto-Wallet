import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import {
  SecretEncryption,
  type EncryptedSecret,
} from "./secret-encryption.js";

import {
  TotpRepository,
  type TotpFactorRecord,
} from "./totp-repository.js";

const SECRET_BYTES = 20;
const CODE_DIGITS = 6;
const TIME_STEP_SECONDS = 30;
const DEFAULT_WINDOW = 1;

const BASE32_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export interface TotpServiceOptions {
  secretEncryption: SecretEncryption;
  repository: TotpRepository;
}

export interface CreatedTotpFactor {
  factor: TotpFactorRecord;
  secret: string;
}

export interface VerifyTotpCodeInput {
  identityAccountId: string;
  code: string;
  now?: Date;
  window?: number;
}

export class TotpService {
  private readonly secretEncryption: SecretEncryption;
  private readonly repository: TotpRepository;

  constructor(options: TotpServiceOptions) {
    this.secretEncryption =
      options.secretEncryption;

    this.repository = options.repository;
  }

  async createFactor(
    identityAccountId: string,
  ): Promise<CreatedTotpFactor> {
    if (
      typeof identityAccountId !== "string" ||
      identityAccountId.trim().length === 0
    ) {
      throw new Error(
        "Identity account ID is required",
      );
    }

    const secret = generateTotpSecret();

    const encrypted =
      this.secretEncryption.encrypt(secret);

    const factor =
      await this.repository.createFactor({
        identityAccountId,
        encryptedSecret: encrypted.ciphertext,
        secretNonce: encrypted.nonce,
        encryptionKeyVersion:
          encrypted.keyVersion,
      });

    return {
      factor,
      secret,
    };
  }

  async getActiveFactor(
    identityAccountId: string,
  ): Promise<TotpFactorRecord | null> {
    if (
      typeof identityAccountId !== "string" ||
      identityAccountId.trim().length === 0
    ) {
      throw new Error(
        "Identity account ID is required",
      );
    }

    return this.repository.findActiveByIdentityAccountId(
      identityAccountId,
    );
  }

  async enableFactor(
    factorId: string,
    code: string,
    now: Date = new Date(),
  ): Promise<TotpFactorRecord> {
    validateFactorId(factorId);
    validateTotpCode(code);

    const factor =
      await this.repository.findById(factorId);

    if (!factor) {
      throw new Error("TOTP factor not found");
    }

    if (factor.disabledAt !== null) {
      throw new Error("TOTP factor is disabled");
    }

    const secret = this.decryptFactorSecret(factor);

    if (!verifyTotpCode(secret, code, now)) {
      throw new Error("Invalid TOTP code");
    }

    const enabled =
      await this.repository.enableFactor(factorId);

    if (!enabled) {
      throw new Error(
        "Failed to enable TOTP factor",
      );
    }

    return enabled;
  }

  async disableFactor(
    factorId: string,
  ): Promise<TotpFactorRecord> {
    validateFactorId(factorId);

    const disabled =
      await this.repository.disableFactor(factorId);

    if (!disabled) {
      throw new Error(
        "TOTP factor not found or already disabled",
      );
    }

    return disabled;
  }

  async verifyCode(
    input: VerifyTotpCodeInput,
  ): Promise<boolean> {
    if (
      typeof input.identityAccountId !== "string" ||
      input.identityAccountId.trim().length === 0
    ) {
      throw new Error(
        "Identity account ID is required",
      );
    }

    validateTotpCode(input.code);

    const window =
      input.window ?? DEFAULT_WINDOW;

    if (
      !Number.isInteger(window) ||
      window < 0 ||
      window > 5
    ) {
      throw new Error(
        "TOTP verification window is invalid",
      );
    }

    const factor =
      await this.repository.findActiveByIdentityAccountId(
        input.identityAccountId,
      );

    if (!factor) {
      return false;
    }

    const secret = this.decryptFactorSecret(factor);

    return verifyTotpCode(
      secret,
      input.code,
      input.now ?? new Date(),
      window,
    );
  }

  private decryptFactorSecret(
    factor: TotpFactorRecord,
  ): string {
    const encrypted: EncryptedSecret = {
      ciphertext: factor.encryptedSecret,
      nonce: factor.secretNonce,
      keyVersion:
        factor.encryptionKeyVersion,
    };

    return this.secretEncryption.decrypt(
      encrypted,
    );
  }
}

function generateTotpSecret(): string {
  return base32Encode(randomBytes(SECRET_BYTES));
}

function verifyTotpCode(
  secret: string,
  code: string,
  now: Date = new Date(),
  window: number = DEFAULT_WINDOW,
): boolean {
  const normalizedSecret =
    secret.trim().toUpperCase();

  let decodedSecret: Buffer;

  try {
    decodedSecret =
      base32Decode(normalizedSecret);
  } catch {
    return false;
  }

  const timestamp = Math.floor(
    now.getTime() / 1000,
  );

  const currentCounter = Math.floor(
    timestamp / TIME_STEP_SECONDS,
  );

  for (
    let offset = -window;
    offset <= window;
    offset += 1
  ) {
    const counter = currentCounter + offset;

    if (counter < 0) {
      continue;
    }

    const expectedCode =
      generateTotpCode(
        decodedSecret,
        counter,
      );

    if (safeCodeEqual(expectedCode, code)) {
      return true;
    }
  }

  return false;
}

function generateTotpCode(
  secret: Buffer,
  counter: number,
): string {
  const counterBuffer = Buffer.alloc(8);

  counterBuffer.writeBigUInt64BE(
    BigInt(counter),
  );

  const digest = createHmac(
    "sha1",
    secret,
  )
    .update(counterBuffer)
    .digest();

  const offset =
    digest[digest.length - 1]! & 0x0f;

  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);

  const code =
    binary %
    10 ** CODE_DIGITS;

  return code
    .toString()
    .padStart(CODE_DIGITS, "0");
}

function safeCodeEqual(
  expected: string,
  actual: string,
): boolean {
  const expectedBuffer =
    Buffer.from(expected, "ascii");

  const actualBuffer =
    Buffer.from(actual, "ascii");

  if (
    expectedBuffer.length !==
    actualBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    expectedBuffer,
    actualBuffer,
  );
}

function validateFactorId(
  factorId: string,
): void {
  if (
    typeof factorId !== "string" ||
    factorId.trim().length === 0
  ) {
    throw new Error(
      "TOTP factor ID is required",
    );
  }
}

function validateTotpCode(code: string): void {
  if (
    typeof code !== "string" ||
    !/^\d{6}$/.test(code)
  ) {
    throw new Error(
      "TOTP code must be exactly 6 digits",
    );
  }
}

function base32Encode(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      bits -= 5;

      output +=
        BASE32_ALPHABET[
          (value >> bits) & 31
        ];
    }
  }

  if (bits > 0) {
    output +=
      BASE32_ALPHABET[
        (value << (5 - bits)) & 31
      ];
  }

  return output;
}

function base32Decode(input: string): Buffer {
  const normalized = input
    .replace(/[\s=-]/g, "")
    .toUpperCase();

  if (normalized.length === 0) {
    throw new Error(
      "TOTP secret is empty",
    );
  }

  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const character of normalized) {
    const index =
      BASE32_ALPHABET.indexOf(character);

    if (index === -1) {
      throw new Error(
        "Invalid TOTP secret",
      );
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;

      bytes.push(
        (value >> bits) & 0xff,
      );
    }
  }

  return Buffer.from(bytes);
}