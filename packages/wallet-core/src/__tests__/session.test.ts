import { describe, expect, it } from "vitest";
import type { WalletCrypto } from "@crypto-wallet/crypto";

import { DefaultWalletSession, type WalletSession } from "../index.js";

import type { SecureVault, VaultState } from "@crypto-wallet/secure-storage";

class TestVault implements SecureVault {
  private locked = true;
  private persisted = false;

  get state(): VaultState {
    return {
      locked: this.locked,
      lastActivityAt: null,
      lockedAt: null,
    };
  }

  async hasPersistedData(): Promise<boolean> {
    return false;
  }

  async unlock(_password: string): Promise<void> {
    this.locked = false;
  }

  lock(): void {
    this.locked = true;
  }

  async persist(): Promise<void> {
    this.persisted = true;
  }

  wasPersisted(): boolean {
    return this.persisted;
  }

  get(_key: string): Uint8Array | null {
    return null;
  }

  set(_key: string, _value: Uint8Array): void {}

  remove(_key: string): void {}

  touch(): void {}
}

describe("DefaultWalletSession", () => {
  it("delegates unlock and lock to the vault", async () => {
    const vault = new TestVault();
    const session: WalletSession = new DefaultWalletSession(vault, crypto);

    expect(session.vault).toBe(vault);
    expect(session.lifecycle).toBeDefined();
    expect(vault.state.locked).toBe(true);

    await session.unlock("test-password");

    expect(vault.state.locked).toBe(false);

    session.lock();

    expect(vault.state.locked).toBe(true);
  });

  const crypto: WalletCrypto = {
    mnemonic: {
      generate: () => "test mnemonic",
      validate: () => true,
      toSeed: async () => {
        throw new Error("not implemented in session tests");
      },
    },
    deriver: {
      fromSeed: () => {
        throw new Error("not implemented in session tests");
      },
      derive: () => {
        throw new Error("not implemented in session tests");
      },
    },
    signer: {
      signDigest: () => {
        throw new Error("not implemented in session tests");
      },
    },
  };

  it("exposes the configured wallet crypto service", () => {
    const vault = new TestVault();
    const session = new DefaultWalletSession(vault, crypto);

    expect(session.crypto).toBe(crypto);
  });

  it("exposes the vault state", async () => {
    const vault = new TestVault();
    const session = new DefaultWalletSession(vault, crypto);

    expect(session.state.locked).toBe(true);

    await session.unlock("test-password");

    expect(session.state.locked).toBe(false);

    session.lock();

    expect(session.state.locked).toBe(true);
  });

  it("delegates persistence to the vault", async () => {
    const vault = new TestVault();
    const session = new DefaultWalletSession(vault, crypto);

    await session.persist();

    expect(vault.wasPersisted()).toBe(true);
  });
  it("exposes the wallet lifecycle service", () => {
    const vault = new TestVault();

    const session = new DefaultWalletSession(vault, crypto);

    expect(session.lifecycle).toBeDefined();
    expect(session.lifecycle.create).toBeTypeOf("function");
    expect(session.lifecycle.restore).toBeTypeOf("function");
  });
});
