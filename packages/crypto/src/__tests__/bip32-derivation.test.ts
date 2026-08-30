import { describe, expect, it } from "vitest";

import { Bip32WalletKeyDeriver } from "../bip32-derivation.js";
import { ManagedSecretBytes } from "../secret-bytes.js";

describe("Bip32WalletKeyDeriver", () => {
  const deriver = new Bip32WalletKeyDeriver();

  it("derives deterministic keys from the same seed", () => {
    const seed = new ManagedSecretBytes(
      Uint8Array.from(
        Array.from({ length: 32 }, (_, index) => index),
      ),
    );

    const first = deriver.fromSeed(seed);
    const second = deriver.fromSeed(seed);

    expect(first.publicKey()).toEqual(second.publicKey());
    expect(first.privateKey().copy()).toEqual(second.privateKey().copy());

    first.wipe();
    second.wipe();
    seed.wipe();
  });

  it("derives a child key from a BIP-32 path", () => {
    const seed = new ManagedSecretBytes(
      Uint8Array.from(
        Array.from({ length: 32 }, (_, index) => index),
      ),
    );

    const root = deriver.fromSeed(seed);
    const child = deriver.derive(root, {
      value: "m/0'/1/2'",
    });

    expect(child.publicKey()).not.toEqual(root.publicKey());
    expect(child.privateKey().copy()).not.toEqual(root.privateKey().copy());

    root.wipe();
    child.wipe();
    seed.wipe();
  });

  it("returns defensive copies of public keys", () => {
    const seed = new ManagedSecretBytes(
      Uint8Array.from(
        Array.from({ length: 32 }, (_, index) => index),
      ),
    );

    const key = deriver.fromSeed(seed);

    const first = key.publicKey();

    expect(first).toHaveLength(33);

    first[0] = (first[0] ?? 0) ^ 0xff;

    expect(key.publicKey()).not.toEqual(first);

    key.wipe();
    seed.wipe();
  });

  it("returns managed secret material for private keys", () => {
    const seed = new ManagedSecretBytes(
      Uint8Array.from(
        Array.from({ length: 32 }, (_, index) => index),
      ),
    );

    const key = deriver.fromSeed(seed);
    const privateKey = key.privateKey();

    expect(privateKey.copy()).toHaveLength(32);
    expect(privateKey.isWiped).toBe(false);

    privateKey.wipe();
    key.wipe();
    seed.wipe();

    expect(privateKey.isWiped).toBe(true);
  });

  it("rejects an empty derivation path", () => {
    const seed = new ManagedSecretBytes(
      Uint8Array.from(
        Array.from({ length: 32 }, (_, index) => index),
      ),
    );

    const root = deriver.fromSeed(seed);

    expect(() => deriver.derive(root, { value: " " })).toThrow(
      "Derivation path is required",
    );

    root.wipe();
    seed.wipe();
  });

  it("rejects derived keys from another implementation", () => {
    const foreignKey = {
      privateKey: () =>
        new ManagedSecretBytes(new Uint8Array(32)),
      publicKey: () => new Uint8Array(33),
      wipe: () => undefined,
    };

    expect(() =>
      deriver.derive(foreignKey, { value: "m/0'" }),
    ).toThrow("Unsupported derived key implementation");
  });
    it("matches the official BIP-32 derivation vector", () => {
    const seed = new ManagedSecretBytes(
      Uint8Array.from(
        [
          "000102030405060708090a0b0c0d0e0f",
        ]
          .join("")
          .match(/.{2}/g)!
          .map((byte) => Number.parseInt(byte, 16)),
      ),
    );

    const root = deriver.fromSeed(seed);

    const child = deriver.derive(root, {
      value: "m/0'/1/2'",
    });

    const expectedPrivateKey = Uint8Array.from(
      "cbce0d719ecf7431d88e6a89fa1483e02e35092af60c042b1df2ff59fa424dca"
        .match(/.{2}/g)!
        .map((byte) => Number.parseInt(byte, 16)),
    );

    const expectedPublicKey = Uint8Array.from(
      "0357bfe1e341d01c69fe5654309956cbea516822fba8a601743a012a7896ee8dc2"
        .match(/.{2}/g)!
        .map((byte) => Number.parseInt(byte, 16)),
    );

    expect(child.privateKey().copy()).toEqual(expectedPrivateKey);
    expect(child.publicKey()).toEqual(expectedPublicKey);

    root.wipe();
    child.wipe();
    seed.wipe();
  });
});