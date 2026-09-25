import {
  MemorySecureStorageAdapter,
  type SecureStorageOptions,
} from "@crypto-wallet/secure-storage";
import { describe, expect, it } from "vitest";

import { createWallet, MNEMONIC_STORAGE_KEY } from "../index.js";

describe("wallet lifecycle end-to-end", () => {
  const options: SecureStorageOptions = {
    inactivityTimeoutMs: 60_000,
  };

  it("creates, persists, locks, unlocks, and recovers a wallet", async () => {
    const adapter = new MemorySecureStorageAdapter();
    const password = "day28-test-password";

    const firstSession = createWallet(adapter, options);

    expect(await firstSession.lifecycle.exists()).toBe(false);

    const created = await firstSession.lifecycle.create(password);

    expect(created.mnemonic).toBeTruthy();
    expect(await firstSession.lifecycle.exists()).toBe(true);

    firstSession.vault.lock();

    expect(firstSession.vault.state.locked).toBe(true);

    const secondSession = createWallet(adapter, options);

    expect(await secondSession.lifecycle.exists()).toBe(true);

    await secondSession.vault.unlock(password);

    const storedMnemonic = secondSession.vault.get(MNEMONIC_STORAGE_KEY);

    expect(storedMnemonic).not.toBeNull();
    expect(new TextDecoder().decode(storedMnemonic!)).toBe(created.mnemonic);
  });

  it("restores a wallet from a valid recovery mnemonic", async () => {
    const sourceAdapter = new MemorySecureStorageAdapter();
    const sourceSession = createWallet(sourceAdapter, options);

    const { mnemonic } = await sourceSession.lifecycle.create("source-password");

    const restoreAdapter = new MemorySecureStorageAdapter();
    const restoreSession = createWallet(restoreAdapter, options);

    expect(await restoreSession.lifecycle.exists()).toBe(false);

    await restoreSession.lifecycle.restore("restore-password", mnemonic);

    expect(await restoreSession.lifecycle.exists()).toBe(true);

    const storedMnemonic = restoreSession.vault.get(MNEMONIC_STORAGE_KEY);

    expect(storedMnemonic).not.toBeNull();
    expect(new TextDecoder().decode(storedMnemonic!)).toBe(mnemonic);
  });

  it("rejects an invalid recovery mnemonic without persisting it", async () => {
    const adapter = new MemorySecureStorageAdapter();
    const session = createWallet(adapter, options);

    await expect(
      session.lifecycle.restore(
        "restore-password",
        "this is definitely not a valid recovery mnemonic",
      ),
    ).rejects.toThrow("Invalid wallet mnemonic");

    expect(await session.lifecycle.exists()).toBe(false);
  });
});
