import { describe, expect, it } from "vitest";

import { WebCryptoVaultCipher } from "../web-crypto-vault-cipher.js";

describe("WebCryptoVaultCipher", () => {
  it("encrypts and decrypts plaintext", async () => {
    const cipher = new WebCryptoVaultCipher();
    const session = await cipher.createSession("test-password");

    const plaintext = new TextEncoder().encode("wallet-secret");

    const ciphertext = await session.encrypt(plaintext);
    const decrypted = await session.decrypt(ciphertext);

    expect(decrypted).toEqual(plaintext);
    expect(ciphertext).not.toEqual(plaintext);
  });

  it("decrypts only with the correct password", async () => {
    const cipher = new WebCryptoVaultCipher();

    const encryptSession = await cipher.createSession("correct-password");
    const decryptSession = await cipher.createSession("wrong-password");

    const plaintext = new TextEncoder().encode("wallet-secret");

    const ciphertext = await encryptSession.encrypt(plaintext);

    await expect(decryptSession.decrypt(ciphertext)).rejects.toThrow("Vault decryption failed");
  });

  it("produces different ciphertext for repeated encryption", async () => {
    const cipher = new WebCryptoVaultCipher();
    const session = await cipher.createSession("test-password");

    const plaintext = new TextEncoder().encode("wallet-secret");

    const first = await session.encrypt(plaintext);
    const second = await session.encrypt(plaintext);

    expect(first).not.toEqual(second);
  });

  it("rejects tampered ciphertext", async () => {
    const cipher = new WebCryptoVaultCipher();
    const session = await cipher.createSession("test-password");

    const plaintext = new TextEncoder().encode("wallet-secret");

    const ciphertext = await session.encrypt(plaintext);

    const envelope = JSON.parse(new TextDecoder().decode(ciphertext)) as {
      version: number;
      kdf: string;
      iterations: number;
      keyLength: number;
      salt: number[];
      nonce: number[];
      ciphertext: number[];
    };

    envelope.ciphertext[0] = (envelope.ciphertext[0] ?? 0) ^ 1;

    const tampered = new TextEncoder().encode(JSON.stringify(envelope));

    await expect(session.decrypt(tampered)).rejects.toThrow("Vault decryption failed");
  });

  it("rejects malformed encrypted payloads", async () => {
    const cipher = new WebCryptoVaultCipher();
    const session = await cipher.createSession("test-password");

    const malformed = new TextEncoder().encode(
      JSON.stringify({
        version: 1,
        salt: [],
        nonce: [],
        ciphertext: [],
      }),
    );

    await expect(session.decrypt(malformed)).rejects.toThrow("Invalid encrypted vault payload");
  });

  it("supports empty plaintext", async () => {
    const cipher = new WebCryptoVaultCipher();
    const session = await cipher.createSession("test-password");

    const plaintext = new Uint8Array();

    const ciphertext = await session.encrypt(plaintext);
    const decrypted = await session.decrypt(ciphertext);

    expect(decrypted).toEqual(plaintext);
  });
  it("rejects an empty vault password", async () => {
    const cipher = new WebCryptoVaultCipher();

    await expect(cipher.createSession("")).rejects.toThrow("Vault password must not be empty");
  });
  it("stores a versioned encrypted envelope", async () => {
    const cipher = new WebCryptoVaultCipher();
    const session = await cipher.createSession("test-password");

    const plaintext = new TextEncoder().encode("wallet-secret");

    const encrypted = await session.encrypt(plaintext);

    const envelope = JSON.parse(new TextDecoder().decode(encrypted)) as {
      version: number;
      kdf: string;
      iterations: number;
      keyLength: number;
      salt: number[];
      cipher: string;
      nonce: number[];
      ciphertext: number[];
    };

    expect(envelope.version).toBe(1);
    expect(envelope.kdf).toBe("PBKDF2-SHA-256");
    expect(envelope.iterations).toBe(100_000);
    expect(envelope.keyLength).toBe(32);
    expect(envelope.cipher).toBe("AES-256-GCM");
    expect(envelope.salt).toHaveLength(16);
    expect(envelope.nonce).toHaveLength(12);
    expect(envelope.ciphertext.length).toBeGreaterThan(0);
  });
});
