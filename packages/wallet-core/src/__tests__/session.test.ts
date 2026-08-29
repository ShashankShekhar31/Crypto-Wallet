import { describe, expect, it } from "vitest";

import {
  DefaultWalletSession,
  type WalletSession,
} from "../index.js";

import type {
  SecureVault,
  VaultState,
} from "@crypto-wallet/secure-storage";

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
    const session: WalletSession = new DefaultWalletSession(vault);

    expect(session.vault).toBe(vault);
    expect(vault.state.locked).toBe(true);

    await session.unlock("test-password");

    expect(vault.state.locked).toBe(false);

    session.lock();

    expect(vault.state.locked).toBe(true);
  });

  it("exposes the vault state", async () => {
        const vault = new TestVault();
        const session = new DefaultWalletSession(vault);

        expect(session.state.locked).toBe(true);

        await session.unlock("test-password");

        expect(session.state.locked).toBe(false);

        session.lock();

        expect(session.state.locked).toBe(true);
    });

    it("delegates persistence to the vault", async () => {
        const vault = new TestVault();
        const session = new DefaultWalletSession(vault);

        await session.persist();

        expect(vault.wasPersisted()).toBe(true);
    });
});