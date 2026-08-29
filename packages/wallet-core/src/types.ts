import type {
  SecureVault,
  VaultState,
} from "@crypto-wallet/secure-storage";

export interface WalletSession {
  readonly vault: SecureVault;
  readonly state: VaultState;

  unlock(password: string): Promise<void>;
  lock(): void;
  persist(): Promise<void>;
}