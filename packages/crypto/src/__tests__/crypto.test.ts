import { describe, expect, it } from "vitest";
import { WebCryptoProvider } from "../web-crypto.js";

import {
  type CryptoProvider,
  type KeyDerivationProvider,
} from "../index.js";

describe("crypto contracts", () => {
  it("defines a random-bytes provider", () => {
    const provider: CryptoProvider = {
      randomBytes(length: number): Uint8Array {
        return new Uint8Array(length);
      },

      async hash(
        _algorithm: "SHA-256" | "SHA-512",
        _data: Uint8Array,
      ): Promise<Uint8Array> {
        return new Uint8Array();
      },
    };

    expect(provider.randomBytes(32)).toHaveLength(32);
  });

  it("defines a key-derivation provider", async () => {
    const provider: KeyDerivationProvider = {
      async deriveKey(
        _password: string,
        params,
      ) {
        return {
          bytes: new Uint8Array(params.keyLength),
        };
      },
    };

    const key = await provider.deriveKey("test-password", {
      salt: new Uint8Array(16),
      iterations: 1,
      keyLength: 32,
    });

    expect(key.bytes).toHaveLength(32);
  });
  it("generates cryptographically random bytes", () => {
  const provider = new WebCryptoProvider();

  const first = provider.randomBytes(32);
  const second = provider.randomBytes(32);

  expect(first).toHaveLength(32);
  expect(second).toHaveLength(32);
  expect(first).not.toEqual(second);
});

it("hashes data with SHA-256", async () => {
  const provider = new WebCryptoProvider();

  const data = new TextEncoder().encode("crypto-wallet");

  const digest = await provider.hash("SHA-256", data);

  expect(digest).toHaveLength(32);
});

it("hashes data with SHA-512", async () => {
  const provider = new WebCryptoProvider();

  const data = new TextEncoder().encode("crypto-wallet");

  const digest = await provider.hash("SHA-512", data);

  expect(digest).toHaveLength(64);
});

it("rejects invalid random byte lengths", () => {
  const provider = new WebCryptoProvider();

  expect(() => provider.randomBytes(0)).toThrow(
    "Random byte length must be a positive integer",
  );

  expect(() => provider.randomBytes(-1)).toThrow(
    "Random byte length must be a positive integer",
  );
});
it("derives a deterministic key for the same inputs", async () => {
  const provider = new WebCryptoProvider();

  const params = {
    salt: new Uint8Array(16),
    iterations: 1_000,
    keyLength: 32,
  };

  const first = await provider.deriveKey("test-password", params);
  const second = await provider.deriveKey("test-password", params);

  expect(first.bytes).toEqual(second.bytes);
  expect(first.bytes).toHaveLength(32);
});

it("produces different keys for different passwords", async () => {
  const provider = new WebCryptoProvider();

  const params = {
    salt: new Uint8Array(16),
    iterations: 1_000,
    keyLength: 32,
  };

  const first = await provider.deriveKey("password-one", params);
  const second = await provider.deriveKey("password-two", params);

  expect(first.bytes).not.toEqual(second.bytes);
});

it("rejects invalid PBKDF2 parameters", async () => {
  const provider = new WebCryptoProvider();

  await expect(
    provider.deriveKey("test-password", {
      salt: new Uint8Array(16),
      iterations: 0,
      keyLength: 32,
    }),
  ).rejects.toThrow("PBKDF2 iterations");

  await expect(
    provider.deriveKey("test-password", {
      salt: new Uint8Array(),
      iterations: 1_000,
      keyLength: 32,
    }),
  ).rejects.toThrow("PBKDF2 salt");
});
});