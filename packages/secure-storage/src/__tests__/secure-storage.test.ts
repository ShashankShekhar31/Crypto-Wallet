import { describe, expect, it } from "vitest";

import {
    createWalletVault,
    MemorySecureStorageAdapter,
    WalletVault,
    WebCryptoVaultCipher,
    type SecureStorageAdapter,
    type VaultCipher,
} from "../index.js";

class MemoryAdapter implements SecureStorageAdapter {
  private value: Uint8Array | null = null;

  async get(_key: string): Promise<Uint8Array | null> {
    return this.value;
  }

  async set(_key: string, value: Uint8Array): Promise<void> {
    this.value = new Uint8Array(value);
  }

  async remove(): Promise<void> {
    this.value = null;
  }

  async clear(): Promise<void> {
    this.value = null;
  }
}

class TestCipher implements VaultCipher {
  async createSession(_password: string) {
    return {
      async encrypt(plaintext: Uint8Array): Promise<Uint8Array> {
        return new Uint8Array(plaintext);
      },

      async decrypt(ciphertext: Uint8Array): Promise<Uint8Array> {
        return new Uint8Array(ciphertext);
      },
    };
  }
}

describe("MemorySecureStorageAdapter", () => {
  it("starts locked", () => {
    const vault = new WalletVault(
      new MemoryAdapter(),
      new TestCipher(),
      { inactivityTimeoutMs: 1_000 },
    );

    expect(vault.state.locked).toBe(true);
  });

  it("creates a vault with the production Web Crypto cipher", async () => {
  const adapter = new MemorySecureStorageAdapter();

  const vault = createWalletVault(adapter, {
    inactivityTimeoutMs: 1_000,
  });

  await vault.unlock("strong-test-password");

  vault.set(
    "wallet-secret",
    new Uint8Array([10, 20, 30]),
  );

  await vault.persist();

  expect(await adapter.get("wallet-vault")).not.toBeNull();
});

  it("stores, returns, and removes values in memory", async () => {
  const adapter = new MemorySecureStorageAdapter();

  const value = new Uint8Array([1, 2, 3]);

  await adapter.set("wallet-secret", value);

  value[0] = 99;

  expect(await adapter.get("wallet-secret")).toEqual(
    new Uint8Array([1, 2, 3]),
  );

  await adapter.remove("wallet-secret");

  expect(await adapter.get("wallet-secret")).toBeNull();
});

it("clears all values from memory storage", async () => {
  const adapter = new MemorySecureStorageAdapter();

  await adapter.set("secret-one", new Uint8Array([1]));
  await adapter.set("secret-two", new Uint8Array([2]));

  await adapter.clear();

  expect(await adapter.get("secret-one")).toBeNull();
  expect(await adapter.get("secret-two")).toBeNull();
});

it("returns defensive copies from memory storage", async () => {
  const adapter = new MemorySecureStorageAdapter();

  await adapter.set(
    "wallet-secret",
    new Uint8Array([1, 2, 3]),
  );

  const value = await adapter.get("wallet-secret");

  expect(value).not.toBeNull();

  if (value !== null) {
    value[0] = 99;
  }

  expect(await adapter.get("wallet-secret")).toEqual(
    new Uint8Array([1, 2, 3]),
  );
});

  it("unlocks an empty vault", async () => {
    const vault = new WalletVault(
      new MemoryAdapter(),
      new TestCipher(),
      { inactivityTimeoutMs: 1_000 },
    );

    await vault.unlock("test-password");

    expect(vault.state.locked).toBe(false);
    expect(vault.state.lastActivityAt).not.toBeNull();
  });

  it("rejects access while locked", () => {
    const vault = new WalletVault(
      new MemoryAdapter(),
      new TestCipher(),
      { inactivityTimeoutMs: 1_000 },
    );

    expect(() => vault.get("wallet-secret")).toThrow(
      "Wallet vault is locked",
    );
  });

  it("stores and returns a defensive copy", async () => {
    const vault = new WalletVault(
      new MemoryAdapter(),
      new TestCipher(),
      { inactivityTimeoutMs: 1_000 },
    );

    await vault.unlock("test-password");

    const original = new Uint8Array([1, 2, 3]);
    vault.set("wallet-secret", original);

    original[0] = 99;

    const stored = vault.get("wallet-secret");

    expect(stored).toEqual(new Uint8Array([1, 2, 3]));

    if (stored !== null) {
      stored[1] = 99;
    }

    expect(vault.get("wallet-secret")).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it("locks explicitly and clears in-memory values", async () => {
    const vault = new WalletVault(
      new MemoryAdapter(),
      new TestCipher(),
      { inactivityTimeoutMs: 1_000 },
    );

    await vault.unlock("test-password");
    vault.set("wallet-secret", new Uint8Array([1, 2, 3]));

    vault.lock();

    expect(vault.state.locked).toBe(true);
    expect(() => vault.get("wallet-secret")).toThrow(
      "Wallet vault is locked",
    );
  });

  it("automatically locks after inactivity", async () => {
    let currentTime = 1_000;

    const vault = new WalletVault(
      new MemoryAdapter(),
      new TestCipher(),
      {
        inactivityTimeoutMs: 500,
        now: () => currentTime,
      },
    );

    await vault.unlock("test-password");

    expect(vault.state.locked).toBe(false);

    currentTime += 499;

    expect(vault.state.locked).toBe(false);

    currentTime += 1;

    expect(vault.state.locked).toBe(true);
  });

  it("touches activity when accessing stored values", async () => {
    let currentTime = 1_000;

    const vault = new WalletVault(
      new MemoryAdapter(),
      new TestCipher(),
      {
        inactivityTimeoutMs: 500,
        now: () => currentTime,
      },
    );

    await vault.unlock("test-password");
    vault.set("wallet-secret", new Uint8Array([1]));

    currentTime += 400;

    expect(vault.get("wallet-secret")).toEqual(
      new Uint8Array([1]),
    );

    currentTime += 400;

    expect(vault.state.locked).toBe(false);

    currentTime += 500;

    expect(vault.state.locked).toBe(true);
  });

  it("persists encrypted vault data to the storage adapter", async () => {
  const adapter = new MemoryAdapter();

  const vault = new WalletVault(
    adapter,
    new TestCipher(),
    { inactivityTimeoutMs: 1_000 },
  );

  await vault.unlock("test-password");

  vault.set("wallet-secret", new Uint8Array([1, 2, 3]));
  await vault.persist();

  const persisted = await adapter.get("wallet-vault");

  expect(persisted).not.toBeNull();
  expect(persisted).toEqual(
    new TextEncoder().encode(
      JSON.stringify([
        ["wallet-secret", [1, 2, 3]],
      ]),
    ),
  );
});

it("restores persisted values after unlocking a new vault", async () => {
  const adapter = new MemoryAdapter();

  const firstVault = new WalletVault(
    adapter,
    new TestCipher(),
    { inactivityTimeoutMs: 1_000 },
  );

  await firstVault.unlock("test-password");

  firstVault.set("wallet-secret", new Uint8Array([10, 20, 30]));
  await firstVault.persist();
  firstVault.lock();

  const secondVault = new WalletVault(
    adapter,
    new TestCipher(),
    { inactivityTimeoutMs: 1_000 },
  );

  await secondVault.unlock("test-password");

  expect(secondVault.get("wallet-secret")).toEqual(
    new Uint8Array([10, 20, 30]),
  );
});

it("does not persist changes automatically", async () => {
  const adapter = new MemoryAdapter();

  const vault = new WalletVault(
    adapter,
    new TestCipher(),
    { inactivityTimeoutMs: 1_000 },
  );

  await vault.unlock("test-password");

  vault.set("wallet-secret", new Uint8Array([1, 2, 3]));

  expect(await adapter.get("wallet-vault")).toBeNull();
});

it("cannot persist while locked", async () => {
  const adapter = new MemoryAdapter();

  const vault = new WalletVault(
    adapter,
    new TestCipher(),
    { inactivityTimeoutMs: 1_000 },
  );

  await expect(vault.persist()).rejects.toThrow(
    "Wallet vault is locked",
  );
});
it("does not unlock when decryption fails", async () => {
  const adapter = new MemoryAdapter();

  await adapter.set(
    "wallet-vault",
    new TextEncoder().encode("invalid-encrypted-data"),
  );

  class FailingCipher implements VaultCipher {
    async createSession(_password: string) {
      return {
        async encrypt(plaintext: Uint8Array): Promise<Uint8Array> {
          return new Uint8Array(plaintext);
        },

        async decrypt(_ciphertext: Uint8Array): Promise<Uint8Array> {
          throw new Error("Decryption failed");
        },
      };
    }
  }

  const vault = new WalletVault(
    adapter,
    new FailingCipher(),
    { inactivityTimeoutMs: 1_000 },
  );

  await expect(vault.unlock("wrong-password")).rejects.toThrow(
    "Decryption failed",
  );

  expect(vault.state.locked).toBe(true);
  expect(vault.state.lastActivityAt).toBeNull();
});
it("clears the active session when automatically locked", async () => {
  let currentTime = 1_000;

  const vault = new WalletVault(
    new MemoryAdapter(),
    new TestCipher(),
    {
      inactivityTimeoutMs: 500,
      now: () => currentTime,
    },
  );

  await vault.unlock("test-password");
  vault.set("wallet-secret", new Uint8Array([1, 2, 3]));

  currentTime += 500;

  expect(vault.state.locked).toBe(true);

  expect(() => vault.get("wallet-secret")).toThrow(
    "Wallet vault is locked",
  );
});
it("persists and restores vault data using real Web Crypto", async () => {
  const adapter = new MemoryAdapter();
  const cipher = new WebCryptoVaultCipher();

  const firstVault = new WalletVault(
    adapter,
    cipher,
    { inactivityTimeoutMs: 1_000 },
  );

  await firstVault.unlock("strong-test-password");

  firstVault.set(
    "wallet-secret",
    new Uint8Array([10, 20, 30, 40]),
  );

  await firstVault.persist();

  const persisted = await adapter.get("wallet-vault");

  expect(persisted).not.toBeNull();

  firstVault.lock();

  const secondVault = new WalletVault(
    adapter,
    cipher,
    { inactivityTimeoutMs: 1_000 },
  );

  await secondVault.unlock("strong-test-password");

  expect(secondVault.get("wallet-secret")).toEqual(
    new Uint8Array([10, 20, 30, 40]),
  );
});
it("does not unlock with the wrong password", async () => {
  const adapter = new MemoryAdapter();
  const cipher = new WebCryptoVaultCipher();

  const firstVault = new WalletVault(
    adapter,
    cipher,
    { inactivityTimeoutMs: 1_000 },
  );

  await firstVault.unlock("correct-password");

  firstVault.set(
    "wallet-secret",
    new Uint8Array([1, 2, 3]),
  );

  await firstVault.persist();
  firstVault.lock();

  const secondVault = new WalletVault(
    adapter,
    cipher,
    { inactivityTimeoutMs: 1_000 },
  );

  await expect(
    secondVault.unlock("wrong-password"),
  ).rejects.toThrow("Vault decryption failed");

  expect(secondVault.state.locked).toBe(true);
});
});