import { describe, expect, it } from "vitest";

import { MemorySecureStorageAdapter } from "@crypto-wallet/secure-storage";

import { createWallet } from "../create-wallet.js";

const PASSWORD = "test-password";

function createTestWallet() {
  const adapter = new MemorySecureStorageAdapter();

  const session = createWallet(adapter, {
    inactivityTimeoutMs: 15 * 60 * 1000,
  });

  return session;
}

describe("WalletLifecycle.exists", () => {
  it("returns false when no wallet has been persisted", async () => {
    const session = createTestWallet();

    await expect(session.lifecycle.exists()).resolves.toBe(false);
  });

  it("returns true after a wallet has been created", async () => {
    const session = createTestWallet();

    await session.lifecycle.create(PASSWORD);

    await expect(session.lifecycle.exists()).resolves.toBe(true);
  });

  it("can detect an existing wallet without decrypting it", async () => {
    const session = createTestWallet();

    await session.lifecycle.create(PASSWORD);
    session.lock();

    await expect(session.lifecycle.exists()).resolves.toBe(true);
  });
});
