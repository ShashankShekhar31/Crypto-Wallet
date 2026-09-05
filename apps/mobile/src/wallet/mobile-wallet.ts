import { createWallet, type WalletSession } from "@crypto-wallet/wallet-core";
import type { SecureStorageOptions } from "@crypto-wallet/secure-storage";

import { MobileVaultCipher } from "../platform/mobile-vault-cipher";
import { ExpoSecureStorageAdapter } from "../platform/secure-storage";

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

const WALLET_OPTIONS: SecureStorageOptions = {
  inactivityTimeoutMs: INACTIVITY_TIMEOUT_MS,
};

export function createMobileWalletSession(): WalletSession {
  return createWallet(
    new ExpoSecureStorageAdapter(),
    WALLET_OPTIONS,
    undefined,
    new MobileVaultCipher(),
  );
}
