import { DefaultWalletCrypto, type WalletCrypto } from "@crypto-wallet/crypto";
import {
  createWalletVault,
  type SecureStorageAdapter,
  type SecureStorageOptions,
  type VaultCipher,
} from "@crypto-wallet/secure-storage";

import { createWalletSession } from "./create-session.js";

import type { WalletSession } from "./types.js";

export function createWallet(
  adapter: SecureStorageAdapter,
  options: SecureStorageOptions,
  crypto: WalletCrypto = new DefaultWalletCrypto(),
  cipher?: VaultCipher,
): WalletSession {
  const vault = createWalletVault(adapter, options, cipher);
  return createWalletSession(vault, crypto);
}
