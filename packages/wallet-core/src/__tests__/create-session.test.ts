import { describe, expect, it } from "vitest";
import type { WalletCrypto } from "@crypto-wallet/crypto";

import { createWalletSession, type WalletSession } from "../index.js";

import type { SecureVault, VaultState } from "@crypto-wallet/secure-storage";

class TestVault implements SecureVault {
  private locked = true;

  get state(): VaultState {
    return {
      locked: this.locked,
      lastActivityAt: null,
      lockedAt: null,
    };
  }

  async unlock(_password: string): Promise<void> {
    this.locked = false;
  }

  lock(): void {
    this.locked = true;
  }

  async persist(): Promise<void> {}

  get(_key: string): Uint8Array | null {
    return null;
  }

  set(_key: string, _value: Uint8Array): void {}

  remove(_key: string): void {}

  touch(): void {}
}

describe("createWalletSession", () => {
  it("creates a wallet session backed by the supplied vault", () => {
    const vault = new TestVault();

    const crypto: WalletCrypto = {
      mnemonic: {
        generate: () => "test mnemonic",
        validate: () => true,
        toSeed: async () => {
          throw new Error("not implemented in create-session tests");
        },
      },
      deriver: {
        fromSeed: () => {
          throw new Error("not implemented in create-session tests");
        },
        derive: () => {
          throw new Error("not implemented in create-session tests");
        },
      },
      signer: {
        signDigest: () => {
          throw new Error("not implemented in create-session tests");
        },
      },
    };

    const session: WalletSession = createWalletSession(vault, crypto);

    expect(session).toBeDefined();
    expect(session.vault).toBe(vault);
    expect(session.crypto).toBe(crypto);
    expect(session.state).toEqual(vault.state);
  });
});
