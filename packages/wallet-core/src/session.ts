import type { WalletCrypto } from "@crypto-wallet/crypto";

import type { SecureVault, VaultState } from "@crypto-wallet/secure-storage";

import { DefaultWalletLifecycle, type WalletLifecycle } from "./wallet-lifecycle.js";

import type { WalletSession } from "./types.js";

export class DefaultWalletSession implements WalletSession {
  readonly lifecycle: WalletLifecycle;

  constructor(
    readonly vault: SecureVault,
    readonly crypto: WalletCrypto,
  ) {
    this.lifecycle = new DefaultWalletLifecycle(vault, crypto);
  }

  get state(): VaultState {
    return this.vault.state;
  }

  async unlock(password: string): Promise<void> {
    await this.vault.unlock(password);
  }

  lock(): void {
    this.vault.lock();
  }

  async persist(): Promise<void> {
    await this.vault.persist();
  }
}
