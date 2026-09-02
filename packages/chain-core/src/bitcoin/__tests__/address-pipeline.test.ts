import { describe, expect, it } from "vitest";

import { Bip39MnemonicService } from "@crypto-wallet/crypto";

import { deriveBitcoinAddress } from "../address.js";

const MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

describe("deriveBitcoinAddress", () => {
  it("derives the BIP-84 native SegWit address", async () => {
    const mnemonic = new Bip39MnemonicService();

    const seed = await mnemonic.toSeed(MNEMONIC);

    try {
      const address = deriveBitcoinAddress(seed, "native-segwit", "bitcoin-mainnet", 0, 0, 0);

      expect(address).toBe("bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu");
    } finally {
      seed.wipe();
    }
  });

  it("derives the BIP-44 legacy address", async () => {
    const mnemonic = new Bip39MnemonicService();

    const seed = await mnemonic.toSeed(MNEMONIC);

    try {
      const address = deriveBitcoinAddress(seed, "legacy", "bitcoin-mainnet", 0, 0, 0);

      expect(address).toBe("1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA");
    } finally {
      seed.wipe();
    }
  });

  it("derives a testnet native SegWit address", async () => {
    const mnemonic = new Bip39MnemonicService();

    const seed = await mnemonic.toSeed(MNEMONIC);

    try {
      const address = deriveBitcoinAddress(seed, "native-segwit", "bitcoin-testnet", 0, 0, 0);

      expect(address).toMatch(/^tb1q/);
    } finally {
      seed.wipe();
    }
  });

  it("supports change addresses", async () => {
    const mnemonic = new Bip39MnemonicService();

    const seed = await mnemonic.toSeed(MNEMONIC);

    try {
      const receiveAddress = deriveBitcoinAddress(
        seed,
        "native-segwit",
        "bitcoin-mainnet",
        0,
        0,
        0,
      );

      const changeAddress = deriveBitcoinAddress(seed, "native-segwit", "bitcoin-mainnet", 0, 1, 0);

      expect(changeAddress).not.toBe(receiveAddress);

      expect(changeAddress).toMatch(/^bc1q/);
    } finally {
      seed.wipe();
    }
  });

  it("supports multiple address indexes", async () => {
    const mnemonic = new Bip39MnemonicService();

    const seed = await mnemonic.toSeed(MNEMONIC);

    try {
      const firstAddress = deriveBitcoinAddress(seed, "native-segwit", "bitcoin-mainnet", 0, 0, 0);

      const secondAddress = deriveBitcoinAddress(seed, "native-segwit", "bitcoin-mainnet", 0, 0, 1);

      expect(secondAddress).not.toBe(firstAddress);

      expect(secondAddress).toMatch(/^bc1q/);
    } finally {
      seed.wipe();
    }
  });
});
