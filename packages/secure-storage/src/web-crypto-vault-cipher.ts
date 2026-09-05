import { decryptAesGcm, encryptAesGcm, WebCryptoProvider } from "@crypto-wallet/crypto";

import type { VaultCipher, VaultCipherSession, VaultMasterKey } from "./types.js";

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const NONCE_LENGTH = 12;

interface PasswordVaultEnvelope {
  version: 1;
  kdf: "PBKDF2-SHA-256";
  iterations: number;
  keyLength: number;
  salt: number[];
  cipher: "AES-256-GCM";
  nonce: number[];
  ciphertext: number[];
}

interface MasterKeyVaultEnvelope {
  version: 2;
  cipher: "AES-256-GCM";
  nonce: number[];
  ciphertext: number[];
}

export class WebCryptoVaultCipher implements VaultCipher {
  private readonly crypto: WebCryptoProvider;

  constructor(crypto: WebCryptoProvider = new WebCryptoProvider()) {
    this.crypto = crypto;
  }

  async createSession(password: string): Promise<VaultCipherSession> {
    if (password.length === 0) {
      throw new Error("Vault password must not be empty");
    }

    return new PasswordVaultCipherSession(this.crypto, password);
  }

  async createMasterKey(): Promise<VaultMasterKey> {
    return new WebCryptoVaultMasterKey(this.crypto.randomBytes(KEY_LENGTH));
  }

  async createSessionFromMasterKey(masterKey: VaultMasterKey): Promise<VaultCipherSession> {
    if (masterKey.bytes.length !== KEY_LENGTH) {
      throw new Error("Invalid vault master key");
    }

    return new MasterKeyVaultCipherSession(this.crypto, masterKey);
  }
}

class PasswordVaultCipherSession implements VaultCipherSession {
  constructor(
    private readonly crypto: WebCryptoProvider,
    private readonly password: string,
  ) {}

  async encrypt(plaintext: Uint8Array): Promise<Uint8Array> {
    const salt = this.crypto.randomBytes(SALT_LENGTH);

    const key = await this.crypto.deriveKey(this.password, {
      salt,
      iterations: PBKDF2_ITERATIONS,
      keyLength: KEY_LENGTH,
    });

    const nonce = this.crypto.randomBytes(NONCE_LENGTH);

    const ciphertext = await encryptAesGcm(key, plaintext, { nonce });

    const envelope: PasswordVaultEnvelope = {
      version: 1,
      kdf: "PBKDF2-SHA-256",
      iterations: PBKDF2_ITERATIONS,
      keyLength: KEY_LENGTH,
      salt: Array.from(salt),
      cipher: "AES-256-GCM",
      nonce: Array.from(nonce),
      ciphertext: Array.from(ciphertext),
    };

    return new TextEncoder().encode(JSON.stringify(envelope));
  }

  async decrypt(ciphertext: Uint8Array): Promise<Uint8Array> {
    let envelope: unknown;

    try {
      envelope = JSON.parse(new TextDecoder().decode(ciphertext));
    } catch {
      throw new Error("Invalid encrypted vault payload");
    }

    if (!isPasswordVaultEnvelope(envelope)) {
      throw new Error("Invalid encrypted vault payload");
    }

    const key = await this.crypto.deriveKey(this.password, {
      salt: Uint8Array.from(envelope.salt),
      iterations: envelope.iterations,
      keyLength: envelope.keyLength,
    });

    try {
      return await decryptAesGcm(key, Uint8Array.from(envelope.ciphertext), {
        nonce: Uint8Array.from(envelope.nonce),
      });
    } catch {
      throw new Error("Vault decryption failed");
    }
  }
}

class MasterKeyVaultCipherSession implements VaultCipherSession {
  constructor(
    private readonly crypto: WebCryptoProvider,
    private readonly masterKey: VaultMasterKey,
  ) {}

  async encrypt(plaintext: Uint8Array): Promise<Uint8Array> {
    const nonce = this.crypto.randomBytes(NONCE_LENGTH);

    const ciphertext = await encryptAesGcm({ bytes: this.masterKey.bytes }, plaintext, { nonce });

    const envelope: MasterKeyVaultEnvelope = {
      version: 2,
      cipher: "AES-256-GCM",
      nonce: Array.from(nonce),
      ciphertext: Array.from(ciphertext),
    };

    return new TextEncoder().encode(JSON.stringify(envelope));
  }

  async decrypt(ciphertext: Uint8Array): Promise<Uint8Array> {
    let envelope: unknown;

    try {
      envelope = JSON.parse(new TextDecoder().decode(ciphertext));
    } catch {
      throw new Error("Invalid vault envelope");
    }

    if (!isMasterKeyVaultEnvelope(envelope)) {
      throw new Error("Invalid vault envelope");
    }

    try {
      return await decryptAesGcm(
        { bytes: this.masterKey.bytes },
        Uint8Array.from(envelope.ciphertext),
        {
          nonce: Uint8Array.from(envelope.nonce),
        },
      );
    } catch {
      throw new Error("Vault decryption failed");
    }
  }
}

class WebCryptoVaultMasterKey implements VaultMasterKey {
  private _bytes: Uint8Array;

  constructor(bytes: Uint8Array) {
    this._bytes = new Uint8Array(bytes);
  }

  get bytes(): Uint8Array {
    return this._bytes;
  }

  wipe(): void {
    this._bytes.fill(0);
  }
}

function isPasswordVaultEnvelope(value: unknown): value is PasswordVaultEnvelope {
  if (
    typeof value !== "object" ||
    value === null ||
    !("version" in value) ||
    !("salt" in value) ||
    !("nonce" in value) ||
    !("ciphertext" in value)
  ) {
    return false;
  }

  const envelope = value as Record<string, unknown>;

  return (
    envelope.version === 1 &&
    envelope.kdf === "PBKDF2-SHA-256" &&
    envelope.iterations === PBKDF2_ITERATIONS &&
    envelope.keyLength === KEY_LENGTH &&
    envelope.cipher === "AES-256-GCM" &&
    isByteArray(envelope.salt) &&
    envelope.salt.length === SALT_LENGTH &&
    isByteArray(envelope.nonce) &&
    envelope.nonce.length === NONCE_LENGTH &&
    isByteArray(envelope.ciphertext)
  );
}

function isMasterKeyVaultEnvelope(value: unknown): value is MasterKeyVaultEnvelope {
  if (
    typeof value !== "object" ||
    value === null ||
    !("version" in value) ||
    !("cipher" in value) ||
    !("nonce" in value) ||
    !("ciphertext" in value)
  ) {
    return false;
  }

  const envelope = value as Record<string, unknown>;

  return (
    envelope.version === 2 &&
    envelope.cipher === "AES-256-GCM" &&
    isByteArray(envelope.nonce) &&
    envelope.nonce.length === NONCE_LENGTH &&
    isByteArray(envelope.ciphertext)
  );
}

function isByteArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item): item is number =>
        typeof item === "number" && Number.isInteger(item) && item >= 0 && item <= 255,
    )
  );
}
