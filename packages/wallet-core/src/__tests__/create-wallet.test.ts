import {
  DefaultWalletCrypto,
  type WalletCrypto,
} from "@crypto-wallet/crypto";
import {
  MemorySecureStorageAdapter,
  type SecureStorageOptions,
} from "@crypto-wallet/secure-storage";
import { describe, expect, it } from "vitest";

import {
  createWallet,
  type WalletSession,
} from "../index.js";

describe("createWallet", () => {
  const options: SecureStorageOptions = {
    inactivityTimeoutMs: 60_000,
  };

  it("creates a wallet session backed by secure storage", () => {
    const adapter = new MemorySecureStorageAdapter();

    const session: WalletSession = createWallet(
      adapter,
      options,
    );

    expect(session).toBeDefined();
    expect(session.vault).toBeDefined();
    expect(session.lifecycle).toBeDefined();
    expect(session.crypto).toBeInstanceOf(DefaultWalletCrypto);
    expect(session.state.locked).toBe(true);
  });

  it("accepts a custom wallet crypto implementation", () => {
    const adapter = new MemorySecureStorageAdapter();

    const crypto: WalletCrypto = {
      mnemonic: {
        generate: () => "test mnemonic",
        validate: () => true,
        toSeed: async () => {
          throw new Error("not implemented in create-wallet tests");
        },
      },
      deriver: {
        fromSeed: () => {
          throw new Error("not implemented in create-wallet tests");
        },
        derive: () => {
          throw new Error("not implemented in create-wallet tests");
        },
      },
      signer: {
        signDigest: () => {
          throw new Error("not implemented in create-wallet tests");
        },
      },
    };

    const session = createWallet(
      adapter,
      options,
      crypto,
    );

    expect(session.crypto).toBe(crypto);
  });
});