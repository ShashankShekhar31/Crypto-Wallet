import { describe, expect, it } from "vitest";

import {
  createWallet,
  type WalletSession,
} from "../index.js";

import {
  MemorySecureStorageAdapter,
  type SecureStorageOptions,
} from "@crypto-wallet/secure-storage";

describe("createWallet", () => {
  it("creates a wallet session backed by secure storage", () => {
    const adapter = new MemorySecureStorageAdapter();

    const options: SecureStorageOptions = {
      inactivityTimeoutMs: 60_000,
    };

    const session: WalletSession = createWallet(
      adapter,
      options,
    );

    expect(session).toBeDefined();
    expect(session.vault).toBeDefined();
    expect(session.state.locked).toBe(true);
  });
});