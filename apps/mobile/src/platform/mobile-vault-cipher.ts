import * as Crypto from "expo-crypto";
import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";

import type {
  VaultCipher,
  VaultCipherSession,
  VaultMasterKey,
} from "@crypto-wallet/secure-storage";

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;
const ENVELOPE_VERSION = 1;

interface VaultEnvelope {
  version: number;
  salt: number[];
  nonce: number[];
  ciphertext: number[];
}

interface MasterKeyVaultEnvelope {
  version: 2;
  cipher: "AES-256-GCM";
  nonce: number[];
  ciphertext: number[];
}

interface LegacyMasterKeyVaultEnvelope {
  version: 1;
  salt: number[];
  nonce: number[];
  ciphertext: number[];
}

export class MobileVaultCipher implements VaultCipher {
  async createSession(password: string): Promise<VaultCipherSession> {
    return new MobileVaultCipherSession(password);
  }

  async createMasterKey(): Promise<VaultMasterKey> {
    const bytes = await Crypto.getRandomBytesAsync(KEY_LENGTH);

    return {
      bytes,
      wipe(): void {
        bytes.fill(0);
      },
    };
  }

  async createSessionFromMasterKey(masterKey: VaultMasterKey): Promise<VaultCipherSession> {
    if (masterKey.bytes.length !== KEY_LENGTH) {
      throw new Error("Invalid vault master key");
    }

    return new MobileVaultCipherMasterKeySession(new Uint8Array(masterKey.bytes));
  }
}

class MobileVaultCipherSession implements VaultCipherSession {
  constructor(private readonly password: string) {}

  async encrypt(plaintext: Uint8Array): Promise<Uint8Array> {
    const salt = await Crypto.getRandomBytesAsync(SALT_LENGTH);

    const keyBytes = await pbkdf2Async(sha256, this.password, salt, {
      c: PBKDF2_ITERATIONS,
      dkLen: KEY_LENGTH,
    });

    const key = await Crypto.AESEncryptionKey.import(keyBytes);

    const nonce = await Crypto.getRandomBytesAsync(NONCE_LENGTH);

    const sealedData = await Crypto.aesEncryptAsync(plaintext, key, {
      nonce: {
        bytes: nonce,
      },
      tagLength: TAG_LENGTH,
    });

    const ciphertextWithTag = await sealedData.ciphertext({
      encoding: "bytes",
      includeTag: true,
    });

    if (typeof ciphertextWithTag === "string") {
      throw new Error("Unable to encode vault ciphertext.");
    }

    const envelope: VaultEnvelope = {
      version: ENVELOPE_VERSION,
      salt: Array.from(salt),
      nonce: Array.from(nonce),
      ciphertext: Array.from(ciphertextWithTag),
    };

    return utf8ToBytes(JSON.stringify(envelope));
  }

  async decrypt(ciphertext: Uint8Array): Promise<Uint8Array> {
    let envelope: VaultEnvelope;

    try {
      const parsed: unknown = JSON.parse(bytesToUtf8(ciphertext));

      if (!isVaultEnvelope(parsed)) {
        throw new Error("Invalid vault envelope.");
      }

      envelope = parsed;
    } catch {
      throw new Error("Invalid vault envelope.");
    }

    try {
      const salt = Uint8Array.from(envelope.salt);
      const nonce = Uint8Array.from(envelope.nonce);
      const ciphertextWithTag = Uint8Array.from(envelope.ciphertext);

      const keyBytes = await pbkdf2Async(sha256, this.password, salt, {
        c: PBKDF2_ITERATIONS,
        dkLen: KEY_LENGTH,
      });

      const key = await Crypto.AESEncryptionKey.import(keyBytes);

      const sealedData = Crypto.AESSealedData.fromParts(nonce, ciphertextWithTag, TAG_LENGTH);

      const plaintext = await Crypto.aesDecryptAsync(sealedData, key, {
        output: "bytes",
      });

      if (typeof plaintext === "string") {
        throw new Error("Unexpected vault plaintext format.");
      }

      return new Uint8Array(plaintext);
    } catch {
      throw new Error("Vault decryption failed.");
    }
  }
}

class MobileVaultCipherMasterKeySession implements VaultCipherSession {
  constructor(private readonly masterKey: Uint8Array) {}

  async encrypt(plaintext: Uint8Array): Promise<Uint8Array> {
    const nonce = await Crypto.getRandomBytesAsync(NONCE_LENGTH);

    const key = await Crypto.AESEncryptionKey.import(this.masterKey);

    const sealedData = await Crypto.aesEncryptAsync(plaintext, key, {
      nonce: {
        bytes: nonce,
      },
      tagLength: TAG_LENGTH,
    });

    const ciphertextWithTag = await sealedData.ciphertext({
      encoding: "bytes",
      includeTag: true,
    });

    if (typeof ciphertextWithTag === "string") {
      throw new Error("Unable to encode vault ciphertext.");
    }

    const envelope: MasterKeyVaultEnvelope = {
      version: 2,
      cipher: "AES-256-GCM",
      nonce: Array.from(nonce),
      ciphertext: Array.from(ciphertextWithTag),
    };

    return utf8ToBytes(JSON.stringify(envelope));
  }

  async decrypt(ciphertext: Uint8Array): Promise<Uint8Array> {
    let parsed: unknown;

    try {
      parsed = JSON.parse(bytesToUtf8(ciphertext));
    } catch {
      throw new Error("Invalid master key vault envelope.");
    }

    if (isMasterKeyVaultEnvelope(parsed)) {
      return this.decryptV2(parsed);
    }

    if (isLegacyMasterKeyVaultEnvelope(parsed)) {
      return this.decryptLegacy(parsed);
    }

    throw new Error("Invalid master key vault envelope.");
  }

  private async decryptV2(envelope: MasterKeyVaultEnvelope): Promise<Uint8Array> {
    try {
      const key = await Crypto.AESEncryptionKey.import(this.masterKey);

      const sealedData = Crypto.AESSealedData.fromParts(
        Uint8Array.from(envelope.nonce),
        Uint8Array.from(envelope.ciphertext),
        TAG_LENGTH,
      );

      const plaintext = await Crypto.aesDecryptAsync(sealedData, key, {
        output: "bytes",
      });

      if (typeof plaintext === "string") {
        throw new Error("Unexpected vault plaintext format.");
      }

      return new Uint8Array(plaintext);
    } catch {
      throw new Error("Vault decryption failed.");
    }
  }

  private async decryptLegacy(envelope: LegacyMasterKeyVaultEnvelope): Promise<Uint8Array> {
    try {
      const key = await Crypto.AESEncryptionKey.import(this.masterKey);

      const sealedData = Crypto.AESSealedData.fromParts(
        Uint8Array.from(envelope.nonce),
        Uint8Array.from(envelope.ciphertext),
        TAG_LENGTH,
      );

      const plaintext = await Crypto.aesDecryptAsync(sealedData, key, {
        output: "bytes",
      });

      if (typeof plaintext === "string") {
        throw new Error("Unexpected vault plaintext format.");
      }

      return new Uint8Array(plaintext);
    } catch {
      throw new Error("Vault decryption failed.");
    }
  }
}

function isVaultEnvelope(value: unknown): value is VaultEnvelope {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.version === ENVELOPE_VERSION &&
    Array.isArray(candidate.salt) &&
    Array.isArray(candidate.nonce) &&
    Array.isArray(candidate.ciphertext) &&
    candidate.salt.length === SALT_LENGTH &&
    candidate.nonce.length === NONCE_LENGTH &&
    candidate.ciphertext.length >= TAG_LENGTH &&
    candidate.salt.every(isByte) &&
    candidate.nonce.every(isByte) &&
    candidate.ciphertext.every(isByte)
  );
}

function isMasterKeyVaultEnvelope(value: unknown): value is MasterKeyVaultEnvelope {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.version === 2 &&
    candidate.cipher === "AES-256-GCM" &&
    Array.isArray(candidate.nonce) &&
    Array.isArray(candidate.ciphertext) &&
    candidate.nonce.length === NONCE_LENGTH &&
    candidate.ciphertext.length >= TAG_LENGTH &&
    candidate.nonce.every(isByte) &&
    candidate.ciphertext.every(isByte)
  );
}

function isByte(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 255;
}

function bytesToUtf8(bytes: Uint8Array): string {
  let result = "";

  for (let index = 0; index < bytes.length;) {
    const first = bytes[index++];

    if (first === undefined) {
      break;
    }

    if (first < 0x80) {
      result += String.fromCharCode(first);
      continue;
    }

    if ((first & 0xe0) === 0xc0) {
      const second = bytes[index++];

      if (second === undefined) {
        throw new Error("Invalid UTF-8 data.");
      }

      result += String.fromCharCode(((first & 0x1f) << 6) | (second & 0x3f));
      continue;
    }

    if ((first & 0xf0) === 0xe0) {
      const second = bytes[index++];
      const third = bytes[index++];

      if (second === undefined || third === undefined) {
        throw new Error("Invalid UTF-8 data.");
      }

      result += String.fromCharCode(
        ((first & 0x0f) << 12) | ((second & 0x3f) << 6) | (third & 0x3f),
      );
      continue;
    }

    if ((first & 0xf8) === 0xf0) {
      const second = bytes[index++];
      const third = bytes[index++];
      const fourth = bytes[index++];

      if (second === undefined || third === undefined || fourth === undefined) {
        throw new Error("Invalid UTF-8 data.");
      }

      const codePoint =
        ((first & 0x07) << 18) | ((second & 0x3f) << 12) | ((third & 0x3f) << 6) | (fourth & 0x3f);

      const adjusted = codePoint - 0x10000;

      result += String.fromCharCode(0xd800 + (adjusted >> 10), 0xdc00 + (adjusted & 0x3ff));
      continue;
    }

    throw new Error("Invalid UTF-8 data.");
  }

  return result;
}

function isLegacyMasterKeyVaultEnvelope(value: unknown): value is LegacyMasterKeyVaultEnvelope {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.version === 1 &&
    Array.isArray(candidate.salt) &&
    Array.isArray(candidate.nonce) &&
    Array.isArray(candidate.ciphertext) &&
    candidate.salt.length === 0 &&
    candidate.nonce.length === NONCE_LENGTH &&
    candidate.ciphertext.length >= TAG_LENGTH &&
    candidate.salt.every(isByte) &&
    candidate.nonce.every(isByte) &&
    candidate.ciphertext.every(isByte)
  );
}
