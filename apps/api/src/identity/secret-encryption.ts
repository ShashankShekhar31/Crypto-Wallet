import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export interface EncryptedSecret {
  ciphertext: Buffer;
  nonce: Buffer;
  keyVersion: string;
}

export class SecretEncryption {
  constructor(
    private readonly key: Buffer,
    private readonly keyVersion: string,
  ) {
    if (key.length !== KEY_BYTES) {
      throw new Error(
        "Secret encryption key must be 32 bytes",
      );
    }

    if (keyVersion.trim().length === 0) {
      throw new Error(
        "Secret encryption key version is required",
      );
    }
  }

  encrypt(plaintext: string): EncryptedSecret {
    if (
      typeof plaintext !== "string" ||
      plaintext.length === 0
    ) {
      throw new Error(
        "Secret plaintext must be a non-empty string",
      );
    }

    const nonce = randomBytes(NONCE_BYTES);

    const cipher = createCipheriv(
      ALGORITHM,
      this.key,
      nonce,
    );

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
      cipher.getAuthTag(),
    ]);

    return {
      ciphertext,
      nonce,
      keyVersion: this.keyVersion,
    };
  }

  decrypt(
    encrypted: EncryptedSecret,
  ): string {
    if (
      encrypted.keyVersion !== this.keyVersion
    ) {
      throw new Error(
        "Unsupported secret encryption key version",
      );
    }

    if (
      encrypted.nonce.length !== NONCE_BYTES
    ) {
      throw new Error(
        "Invalid secret encryption nonce",
      );
    }

    if (
      encrypted.ciphertext.length <=
      AUTH_TAG_BYTES
    ) {
      throw new Error(
        "Invalid encrypted secret",
      );
    }

    const authTagOffset =
      encrypted.ciphertext.length -
      AUTH_TAG_BYTES;

    const ciphertext =
      encrypted.ciphertext.subarray(
        0,
        authTagOffset,
      );

    const authTag =
      encrypted.ciphertext.subarray(
        authTagOffset,
      );

    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      encrypted.nonce,
    );

    decipher.setAuthTag(authTag);

    try {
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      return plaintext.toString("utf8");
    } catch {
      throw new Error(
        "Failed to decrypt secret",
      );
    }
  }
}