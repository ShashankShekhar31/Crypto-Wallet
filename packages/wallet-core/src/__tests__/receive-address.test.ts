import { describe, expect, it } from "vitest";

import { DefaultWalletCrypto } from "@crypto-wallet/crypto";

import { MemorySecureStorageAdapter, createWalletVault } from "@crypto-wallet/secure-storage";

import { deriveBitcoinReceiveAddress } from "../receive-address.js";

import { MNEMONIC_STORAGE_KEY } from "../wallet-lifecycle.js";

describe("Bitcoin receive address", () => {
  it("derives a Bitcoin receive address from the wallet mnemonic", async () => {
    const adapter = new MemorySecureStorageAdapter();

    const vault = createWalletVault(adapter, {
      inactivityTimeoutMs: 15 * 60 * 1000,
    });

    const crypto = new DefaultWalletCrypto();

    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    await vault.unlock("test-password");

    vault.set(MNEMONIC_STORAGE_KEY, new TextEncoder().encode(mnemonic));

    const address = await deriveBitcoinReceiveAddress(
      vault,
      (value) => crypto.mnemonic.toSeed(value),
      {
        network: "bitcoin-mainnet",
        addressType: "native-segwit",
      },
    );

    expect(address).toMatch(/^bc1/);
  });

  it("derives a testnet receive address when testnet is selected", async () => {
    const adapter = new MemorySecureStorageAdapter();

    const vault = createWalletVault(adapter, {
      inactivityTimeoutMs: 15 * 60 * 1000,
    });

    const crypto = new DefaultWalletCrypto();

    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    await vault.unlock("test-password");

    vault.set(MNEMONIC_STORAGE_KEY, new TextEncoder().encode(mnemonic));

    const address = await deriveBitcoinReceiveAddress(
      vault,
      (value) => crypto.mnemonic.toSeed(value),
      {
        network: "bitcoin-testnet",
        addressType: "native-segwit",
      },
    );

    expect(address).toMatch(/^tb1/);
  });

  it("does not expose the mnemonic as the returned value", async () => {
    const adapter = new MemorySecureStorageAdapter();

    const vault = createWalletVault(adapter, {
      inactivityTimeoutMs: 15 * 60 * 1000,
    });

    const crypto = new DefaultWalletCrypto();

    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    await vault.unlock("test-password");

    vault.set(MNEMONIC_STORAGE_KEY, new TextEncoder().encode(mnemonic));

    const address = await deriveBitcoinReceiveAddress(
      vault,
      (value) => crypto.mnemonic.toSeed(value),
      {
        network: "bitcoin-mainnet",
        addressType: "native-segwit",
      },
    );

    expect(address).not.toBe(mnemonic);
    expect(address).not.toContain("abandon");
  });
});
