import { randomBytes } from "node:crypto";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  SecretEncryption,
} from "../identity/secret-encryption.js";

describe("SecretEncryption", () => {
  it("encrypts and decrypts a secret", () => {
    const key = randomBytes(32);

    const encryption =
      new SecretEncryption(
        key,
        "v1",
      );

    const secret =
      "JBSWY3DPEHPK3PXP";

    const encrypted =
      encryption.encrypt(secret);

    expect(encrypted.ciphertext).toBeInstanceOf(
      Buffer,
    );

    expect(encrypted.nonce).toBeInstanceOf(
      Buffer,
    );

    expect(encrypted.nonce).toHaveLength(12);

    expect(encrypted.keyVersion).toBe("v1");

    expect(
      encrypted.ciphertext.toString("utf8"),
    ).not.toBe(secret);

    const decrypted =
      encryption.decrypt(encrypted);

    expect(decrypted).toBe(secret);
  });

  it("uses a different nonce for each encryption", () => {
    const key = randomBytes(32);

    const encryption =
      new SecretEncryption(
        key,
        "v1",
      );

    const first =
      encryption.encrypt("same-secret");

    const second =
      encryption.encrypt("same-secret");

    expect(first.nonce).not.toEqual(
      second.nonce,
    );

    expect(first.ciphertext).not.toEqual(
      second.ciphertext,
    );
  });

  it("rejects an incorrect encryption key", () => {
    const encryption =
      new SecretEncryption(
        randomBytes(32),
        "v1",
      );

    const encrypted =
      encryption.encrypt(
        "sensitive-totp-secret",
      );

    const wrongKeyEncryption =
      new SecretEncryption(
        randomBytes(32),
        "v1",
      );

    expect(() =>
      wrongKeyEncryption.decrypt(
        encrypted,
      ),
    ).toThrow(
      "Failed to decrypt secret",
    );
  });

  it("rejects a different key version", () => {
    const key = randomBytes(32);

    const encryption =
      new SecretEncryption(
        key,
        "v1",
      );

    const encrypted =
      encryption.encrypt("secret");

    const rotatedEncryption =
      new SecretEncryption(
        key,
        "v2",
      );

    expect(() =>
      rotatedEncryption.decrypt(
        encrypted,
      ),
    ).toThrow(
      "Unsupported secret encryption key version",
    );
  });

  it("rejects an invalid key length", () => {
    expect(
      () =>
        new SecretEncryption(
          randomBytes(16),
          "v1",
        ),
    ).toThrow(
      "Secret encryption key must be 32 bytes",
    );
  });

  it("rejects an empty plaintext", () => {
    const encryption =
      new SecretEncryption(
        randomBytes(32),
        "v1",
      );

    expect(() =>
      encryption.encrypt(""),
    ).toThrow(
      "Secret plaintext must be a non-empty string",
    );
  });

  it("rejects a tampered ciphertext", () => {
    const encryption =
      new SecretEncryption(
        randomBytes(32),
        "v1",
      );

    const encrypted =
      encryption.encrypt("totp-secret");

    encrypted.ciphertext[0] =
      encrypted.ciphertext[0]! ^ 0xff;

    expect(() =>
      encryption.decrypt(
        encrypted,
      ),
    ).toThrow(
      "Failed to decrypt secret",
    );
  });
});