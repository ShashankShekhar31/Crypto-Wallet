import type { WalletCrypto } from "@crypto-wallet/crypto";

import type { SecureVault, VaultState } from "@crypto-wallet/secure-storage";

import type { WalletLifecycle } from "./wallet-lifecycle.js";

export interface WalletSession {
  readonly vault: SecureVault;
  readonly crypto: WalletCrypto;
  readonly lifecycle: WalletLifecycle;
  readonly state: VaultState;

  unlock(password: string): Promise<void>;
  lock(): void;
  persist(): Promise<void>;
}
