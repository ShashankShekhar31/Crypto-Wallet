import { DefaultWalletCrypto } from "@crypto-wallet/crypto";
import { describe, expect, it } from "vitest";

import { LocalKeyManagementProvider, type LocalKeyManagementKey } from "../local-key-management.js";

function createProvider() {
  const crypto = new DefaultWalletCrypto();

  const seed = new Uint8Array(32).fill(1);
  const seedBytes = {
    copy: () => new Uint8Array(seed),
    wipe: () => seed.fill(0),
    get isWiped() {
      return seed.every((byte) => byte === 0);
    },
  };

  const key = crypto.deriver.fromSeed(seedBytes);

  const reference = {
    id: "local-hot-1",
    tier: "hot" as const,
  };

  const entry: LocalKeyManagementKey = {
    reference,
    key,
  };

  return {
    provider: new LocalKeyManagementProvider(crypto, [entry]),
    reference,
    key,
  };
}

describe("LocalKeyManagementProvider", () => {
  it("returns the public key without exposing private-key material", async () => {
    const { provider, reference } = createProvider();

    const publicKey = await provider.getPublicKey(reference);

    expect(publicKey).toBeInstanceOf(Uint8Array);
    expect(publicKey.byteLength).toBeGreaterThan(0);

    expect(provider).not.toHaveProperty("privateKey");
    expect(provider).not.toHaveProperty("privateKeyBytes");
    expect(provider).not.toHaveProperty("seed");
    expect(provider).not.toHaveProperty("mnemonic");
    expect(provider).not.toHaveProperty("getPrivateKey");
    expect(provider).not.toHaveProperty("exportPrivateKey");
  });

  it("signs a 32-byte digest", async () => {
    const { provider, reference } = createProvider();

    const result = await provider.sign({
      key: reference,
      chain: "bitcoin",
      payload: new Uint8Array(32).fill(2),
      correlationId: "test-correlation-id",
    });

    expect(result.keyId).toBe(reference.id);
    expect(result.chain).toBe("bitcoin");
    expect(result.signature).toBeInstanceOf(Uint8Array);
    expect(result.signature.byteLength).toBe(65);
  });

  it("rejects an unknown key reference", async () => {
    const { provider } = createProvider();

    await expect(
      provider.getPublicKey({
        id: "unknown-key",
        tier: "hot",
      }),
    ).rejects.toThrow("Custody key not found: unknown-key");
  });

  it("rejects a key tier mismatch", async () => {
    const { provider, reference } = createProvider();

    await expect(
      provider.getPublicKey({
        id: reference.id,
        tier: "cold",
      }),
    ).rejects.toThrow(`Custody key tier mismatch: ${reference.id}`);
  });

  it("rejects a signing payload that is not a 32-byte digest", async () => {
    const { provider, reference } = createProvider();

    await expect(
      provider.sign({
        key: reference,
        chain: "bitcoin",
        payload: new Uint8Array([1, 2, 3]),
        correlationId: "test-correlation-id",
      }),
    ).rejects.toThrow("Custody signing payload must be exactly 32 bytes");
  });

  it("does not mutate the caller payload", async () => {
    const { provider, reference } = createProvider();

    const payload = new Uint8Array(32).fill(3);

    await provider.sign({
      key: reference,
      chain: "bitcoin",
      payload,
      correlationId: "test-correlation-id",
    });

    expect(payload).toEqual(new Uint8Array(32).fill(3));
  });

  it("returns independent signature bytes", async () => {
    const { provider, reference } = createProvider();

    const first = await provider.sign({
      key: reference,
      chain: "bitcoin",
      payload: new Uint8Array(32).fill(4),
      correlationId: "test-correlation-id",
    });

    first.signature[0] = 99;

    const second = await provider.sign({
      key: reference,
      chain: "bitcoin",
      payload: new Uint8Array(32).fill(4),
      correlationId: "test-correlation-id",
    });

    expect(second.signature[0]).not.toBe(99);
  });

  it("rejects duplicate key references", () => {
    const crypto = new DefaultWalletCrypto();

    const seed = new Uint8Array(32).fill(5);
    const seedBytes = {
      copy: () => new Uint8Array(seed),
      wipe: () => seed.fill(0),
      get isWiped() {
        return seed.every((byte) => byte === 0);
      },
    };

    const key = crypto.deriver.fromSeed(seedBytes);

    const reference = {
      id: "duplicate-key",
      tier: "hot" as const,
    };

    expect(
      () =>
        new LocalKeyManagementProvider(crypto, [
          { reference, key },
          { reference, key },
        ]),
    ).toThrow("Duplicate custody key reference: duplicate-key");
  });
  it("exposes local provider metadata as non-production", () => {
    const { provider } = createProvider();

    expect(provider.metadata).toEqual({
      type: "local",
      productionReady: false,
      managesPrivateKeyMaterial: false,
    });
  });
});
