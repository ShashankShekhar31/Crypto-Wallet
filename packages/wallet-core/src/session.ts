import type {
  SecureVault,
  VaultState,
} from "@crypto-wallet/secure-storage";

import type { WalletSession } from "./types.js";

export class DefaultWalletSession implements WalletSession {
  constructor(
    readonly vault: SecureVault,
  ) {}

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