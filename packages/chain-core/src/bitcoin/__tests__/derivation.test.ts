import { describe, expect, it } from "vitest";

import { deriveBitcoinAddressKey } from "../derivation.js";

import type { SecretBytes } from "@crypto-wallet/crypto";

function createTestSeed(): SecretBytes {
  const bytes = new Uint8Array(64);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = index;
  }

  let wiped = false;

  return {
    copy(): Uint8Array {
      if (wiped) {
        throw new Error("Secret has been wiped");
      }

      return new Uint8Array(bytes);
    },

    wipe(): void {
      bytes.fill(0);
      wiped = true;
    },

    get isWiped(): boolean {
      return wiped;
    },
  };
}

describe("deriveBitcoinAddressKey", () => {
  it("derives a legacy mainnet key", () => {
    const seed = createTestSeed();

    const result = deriveBitcoinAddressKey(seed, "legacy", "bitcoin-mainnet");

    expect(result.path).toBe("m/44'/0'/0'/0/0");

    expect(result.key.publicKey()).toHaveLength(33);

    result.key.wipe();
    seed.wipe();
  });

  it("derives a native SegWit mainnet key", () => {
    const seed = createTestSeed();

    const result = deriveBitcoinAddressKey(seed, "native-segwit", "bitcoin-mainnet");

    expect(result.path).toBe("m/84'/0'/0'/0/0");

    expect(result.key.publicKey()).toHaveLength(33);

    result.key.wipe();
    seed.wipe();
  });

  it("uses testnet coin type", () => {
    const seed = createTestSeed();

    const result = deriveBitcoinAddressKey(seed, "native-segwit", "bitcoin-testnet");

    expect(result.path).toBe("m/84'/1'/0'/0/0");

    result.key.wipe();
    seed.wipe();
  });

  it("supports different account and address indexes", () => {
    const seed = createTestSeed();

    const result = deriveBitcoinAddressKey(seed, "legacy", "bitcoin-mainnet", 2, 0, 7);

    expect(result.path).toBe("m/44'/0'/2'/0/7");

    result.key.wipe();
    seed.wipe();
  });

  it("supports change addresses", () => {
    const seed = createTestSeed();

    const result = deriveBitcoinAddressKey(seed, "legacy", "bitcoin-mainnet", 0, 1, 3);

    expect(result.path).toBe("m/44'/0'/0'/1/3");

    result.key.wipe();
    seed.wipe();
  });

  it("rejects invalid account index", () => {
    const seed = createTestSeed();

    expect(() => deriveBitcoinAddressKey(seed, "legacy", "bitcoin-mainnet", -1)).toThrow(
      "Bitcoin account must be a valid BIP-32 index",
    );

    seed.wipe();
  });

  it("rejects invalid address index", () => {
    const seed = createTestSeed();

    expect(() => deriveBitcoinAddressKey(seed, "legacy", "bitcoin-mainnet", 0, 0, -1)).toThrow(
      "Bitcoin address index must be a valid BIP-32 index",
    );

    seed.wipe();
  });
});
