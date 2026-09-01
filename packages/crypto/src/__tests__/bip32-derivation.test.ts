import { describe, expect, it } from "vitest";

import { Bip32WalletKeyDeriver } from "../bip32-derivation.js";
import { ManagedSecretBytes } from "../secret-bytes.js";

import { createBip44DerivationPath, createDerivationPath } from "../wallet-crypto-types.js";

describe("Bip32WalletKeyDeriver", () => {
  const deriver = new Bip32WalletKeyDeriver();

  it("derives deterministic keys from the same seed", () => {
    const seed = new ManagedSecretBytes(
      Uint8Array.from(Array.from({ length: 32 }, (_, index) => index)),
    );

    const first = deriver.fromSeed(seed);
    const second = deriver.fromSeed(seed);

    expect(first.publicKey()).toEqual(second.publicKey());
    const firstPrivateKey = first.privateKey();
    const secondPrivateKey = second.privateKey();

    expect(firstPrivateKey.copy()).toEqual(secondPrivateKey.copy());

    firstPrivateKey.wipe();
    secondPrivateKey.wipe();

    first.wipe();
    second.wipe();
    seed.wipe();
  });

  it("derives a child key from a BIP-32 path", () => {
    const seed = new ManagedSecretBytes(
      Uint8Array.from(Array.from({ length: 32 }, (_, index) => index)),
    );

    const root = deriver.fromSeed(seed);
    const path = createDerivationPath("m/0'/1/2'");
    const child = deriver.derive(root, path);

    expect(child.publicKey()).not.toEqual(root.publicKey());
    expect(child.privateKey().copy()).not.toEqual(root.privateKey().copy());

    root.wipe();
    child.wipe();
    seed.wipe();
  });

  it("returns defensive copies of public keys", () => {
    const seed = new ManagedSecretBytes(
      Uint8Array.from(Array.from({ length: 32 }, (_, index) => index)),
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
      Uint8Array.from(Array.from({ length: 32 }, (_, index) => index)),
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
      Uint8Array.from(Array.from({ length: 32 }, (_, index) => index)),
    );

    const root = deriver.fromSeed(seed);

    expect(() => deriver.derive(root, { value: " " })).toThrow("Derivation path is required");

    root.wipe();
    seed.wipe();
  });

  it("rejects derived keys from another implementation", () => {
    const foreignKey = {
      privateKey: () => new ManagedSecretBytes(new Uint8Array(32)),
      publicKey: () => new Uint8Array(33),
      wipe: () => undefined,
    };

    expect(() => deriver.derive(foreignKey, { value: "m/0'" })).toThrow(
      "Unsupported derived key implementation",
    );
  });
  it("matches the official BIP-32 derivation vector", () => {
    const seed = new ManagedSecretBytes(
      Uint8Array.from(
        ["000102030405060708090a0b0c0d0e0f"]
          .join("")
          .match(/.{2}/g)!
          .map((byte) => Number.parseInt(byte, 16)),
      ),
    );

    const root = deriver.fromSeed(seed);

    const child = deriver.derive(root, createDerivationPath("m/0'/1/2'"));

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

    const privateKey = child.privateKey();

    expect(privateKey.copy()).toEqual(expectedPrivateKey);

    privateKey.wipe();
    expect(child.publicKey()).toEqual(expectedPublicKey);

    root.wipe();
    child.wipe();
    seed.wipe();
  });

  it("creates validated BIP-32 derivation paths", () => {
    expect(createDerivationPath("m/0'/1/2'").value).toBe("m/0'/1/2'");

    expect(createDerivationPath("m/44'/0'/0'/0/0").value).toBe("m/44'/0'/0'/0/0");
  });

  it("rejects malformed BIP-32 derivation paths", () => {
    expect(() => createDerivationPath("")).toThrow("Derivation path is required");

    expect(() => createDerivationPath(" ")).toThrow("Derivation path is required");

    expect(() => createDerivationPath("invalid")).toThrow("Invalid BIP-32 derivation path");

    expect(() => createDerivationPath("m/foo/1")).toThrow("Invalid BIP-32 derivation path");

    expect(() => createDerivationPath("m/0/")).toThrow("Invalid BIP-32 derivation path");
  });

  it("creates a BIP-44 compatible derivation path", () => {
    const path = createBip44DerivationPath(44, 0, 0, 0, 0);

    expect(path.value).toBe("m/44'/0'/0'/0/0");
  });

  it("rejects invalid BIP-44 components", () => {
    expect(() => createBip44DerivationPath(-1, 0, 0, 0, 0)).toThrow(
      "BIP-44 path components must be non-negative integers",
    );

    expect(() => createBip44DerivationPath(44, 0, 0, 2, 0)).toThrow("BIP-44 change must be 0 or 1");

    expect(() => createBip44DerivationPath(44, 0, 0, 0, 2 ** 31)).toThrow(
      "BIP-44 path component exceeds BIP-32 index range",
    );
  });

  it("rejects malformed paths passed directly to the deriver", () => {
    const seed = new ManagedSecretBytes(
      Uint8Array.from(Array.from({ length: 32 }, (_, index) => index)),
    );

    const root = deriver.fromSeed(seed);

    expect(() => deriver.derive(root, { value: "invalid" })).toThrow(
      "Invalid BIP-32 derivation path",
    );

    root.wipe();
    seed.wipe();
  });
});
