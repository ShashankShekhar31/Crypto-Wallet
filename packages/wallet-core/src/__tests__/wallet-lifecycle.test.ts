import { DefaultWalletCrypto, type WalletCrypto } from "@crypto-wallet/crypto";

import {
  MemorySecureStorageAdapter,
  WalletVault,
  WebCryptoVaultCipher,
  type SecureStorageAdapter,
  type SecureVault,
} from "@crypto-wallet/secure-storage";

import { DefaultWalletLifecycle, MNEMONIC_STORAGE_KEY } from "../index.js";

import { describe, expect, it } from "vitest";

function createTestVault(
  adapter: SecureStorageAdapter = new MemorySecureStorageAdapter(),
): SecureVault {
  return new WalletVault(adapter, new WebCryptoVaultCipher(), {
    inactivityTimeoutMs: 60_000,
  });
}

function createTestCrypto(mnemonic: string, valid: boolean): WalletCrypto {
  return {
    mnemonic: {
      generate: () => mnemonic,
      validate: (value: string) => value === mnemonic && valid,
      toSeed: async () => {
        throw new Error("not implemented in lifecycle tests");
      },
    },

    deriver: {
      fromSeed: () => {
        throw new Error("not implemented in lifecycle tests");
      },
      derive: () => {
        throw new Error("not implemented in lifecycle tests");
      },
    },

    signer: {
      signDigest: () => {
        throw new Error("not implemented in lifecycle tests");
      },
    },
  };
}

describe("DefaultWalletLifecycle", () => {
  it("creates a wallet with a generated mnemonic", async () => {
    const vault = createTestVault();

    const crypto = createTestCrypto("test generated mnemonic", true);

    const lifecycle = new DefaultWalletLifecycle(vault, crypto);

    const result = await lifecycle.create("strong-test-password");

    expect(result.mnemonic).toBe("test generated mnemonic");

    const stored = vault.get(MNEMONIC_STORAGE_KEY);

    expect(stored).toEqual(new TextEncoder().encode("test generated mnemonic"));
  });

  it("restores a valid mnemonic", async () => {
    const vault = createTestVault();

    const crypto = createTestCrypto("valid recovery mnemonic", true);

    const lifecycle = new DefaultWalletLifecycle(vault, crypto);

    await lifecycle.restore("strong-test-password", "valid recovery mnemonic");

    const stored = vault.get(MNEMONIC_STORAGE_KEY);

    expect(stored).toEqual(new TextEncoder().encode("valid recovery mnemonic"));
  });

  it("rejects an invalid mnemonic before changing the vault", async () => {
    const vault = createTestVault();

    const crypto = createTestCrypto("valid recovery mnemonic", false);

    const lifecycle = new DefaultWalletLifecycle(vault, crypto);

    await expect(
      lifecycle.restore("strong-test-password", "invalid recovery mnemonic"),
    ).rejects.toThrow("Invalid wallet mnemonic");

    expect(vault.state.locked).toBe(true);
  });

  it("persists the generated wallet", async () => {
    const adapter = new MemorySecureStorageAdapter();

    const vault = createTestVault(adapter);

    const crypto = createTestCrypto("persisted wallet mnemonic", true);

    const lifecycle = new DefaultWalletLifecycle(vault, crypto);

    await lifecycle.create("strong-test-password");

    expect(await adapter.get("wallet-vault")).not.toBeNull();
  });

  it("does not expose the mnemonic through the vault storage by reference", async () => {
    const vault = createTestVault();

    const crypto = createTestCrypto("defensive copy mnemonic", true);

    const lifecycle = new DefaultWalletLifecycle(vault, crypto);

    await lifecycle.create("strong-test-password");

    const first = vault.get(MNEMONIC_STORAGE_KEY);

    expect(first).not.toBeNull();

    if (first !== null) {
      first.fill(0xff, 0, 1);
    }

    const second = vault.get(MNEMONIC_STORAGE_KEY);

    expect(second).toEqual(new TextEncoder().encode("defensive copy mnemonic"));
  });

  it("does not overwrite an existing wallet during creation", async () => {
    const vault = createTestVault();

    const crypto = createTestCrypto("first wallet mnemonic", true);

    const lifecycle = new DefaultWalletLifecycle(vault, crypto);

    await lifecycle.create("strong-test-password");

    await expect(lifecycle.create("strong-test-password")).rejects.toThrow("Wallet already exists");

    expect(vault.get(MNEMONIC_STORAGE_KEY)).toEqual(
      new TextEncoder().encode("first wallet mnemonic"),
    );
  });

  it("does not overwrite an existing wallet during restore", async () => {
    const vault = createTestVault();

    const crypto = createTestCrypto("first wallet mnemonic", true);

    const lifecycle = new DefaultWalletLifecycle(vault, crypto);

    await lifecycle.create("strong-test-password");

    await expect(
      lifecycle.restore("strong-test-password", "first wallet mnemonic"),
    ).rejects.toThrow("Wallet already exists");

    expect(vault.get(MNEMONIC_STORAGE_KEY)).toEqual(
      new TextEncoder().encode("first wallet mnemonic"),
    );
  });

  it("creates a real BIP-39 mnemonic using the default wallet crypto", async () => {
    const vault = createTestVault();

    const crypto = new DefaultWalletCrypto();

    const lifecycle = new DefaultWalletLifecycle(vault, crypto);

    const result = await lifecycle.create("strong-test-password");

    expect(crypto.mnemonic.validate(result.mnemonic)).toBe(true);

    const wordCount = result.mnemonic.trim().split(/\s+/);

    expect([12, 15, 18, 21, 24]).toContain(wordCount.length);

    const stored = vault.get(MNEMONIC_STORAGE_KEY);

    expect(stored).not.toBeNull();

    if (stored !== null) {
      expect(new TextDecoder().decode(stored)).toBe(result.mnemonic);
    }
  });

  it("restores a real valid BIP-39 mnemonic and preserves it across vault reopen", async () => {
    const adapter = new MemorySecureStorageAdapter();

    const firstVault = createTestVault(adapter);
    const crypto = new DefaultWalletCrypto();

    const lifecycle = new DefaultWalletLifecycle(firstVault, crypto);

    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    await lifecycle.restore("strong-test-password", mnemonic);

    expect(firstVault.get(MNEMONIC_STORAGE_KEY)).toEqual(new TextEncoder().encode(mnemonic));

    firstVault.lock();

    const secondVault = createTestVault(adapter);

    await secondVault.unlock("strong-test-password");

    expect(secondVault.get(MNEMONIC_STORAGE_KEY)).toEqual(new TextEncoder().encode(mnemonic));
  });

  it("rejects a wrong password when opening an existing wallet", async () => {
    const adapter = new MemorySecureStorageAdapter();

    const crypto = new DefaultWalletCrypto();

    const firstVault = createTestVault(adapter);

    const lifecycle = new DefaultWalletLifecycle(firstVault, crypto);

    await lifecycle.create("correct-password");

    firstVault.lock();

    const secondVault = createTestVault(adapter);

    const secondLifecycle = new DefaultWalletLifecycle(secondVault, crypto);

    await expect(
      secondLifecycle.restore(
        "wrong-password",
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
      ),
    ).rejects.toThrow("Vault decryption failed");

    expect(secondVault.state.locked).toBe(true);
  });

  it("rejects a corrupted vault payload", async () => {
    const adapter = new MemorySecureStorageAdapter();

    await adapter.set("wallet-vault", new TextEncoder().encode("corrupted-vault-payload"));

    const vault = createTestVault(adapter);

    const crypto = new DefaultWalletCrypto();

    const lifecycle = new DefaultWalletLifecycle(vault, crypto);

    await expect(
      lifecycle.restore(
        "strong-test-password",
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
      ),
    ).rejects.toThrow("Invalid encrypted vault payload");

    expect(vault.state.locked).toBe(true);
  });

  it("does not persist an invalid recovery mnemonic", async () => {
    const adapter = new MemorySecureStorageAdapter();

    const vault = createTestVault(adapter);

    const crypto = new DefaultWalletCrypto();

    const lifecycle = new DefaultWalletLifecycle(vault, crypto);

    const invalidMnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon";

    await expect(lifecycle.restore("strong-test-password", invalidMnemonic)).rejects.toThrow(
      "Invalid wallet mnemonic",
    );

    expect(await adapter.get("wallet-vault")).toBeNull();

    expect(vault.state.locked).toBe(true);
  });
});
