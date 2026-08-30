import {
  DefaultWalletCrypto,
  type WalletCrypto,
} from "@crypto-wallet/crypto";
import {
  createWalletVault,
  type SecureStorageAdapter,
  type SecureStorageOptions,
} from "@crypto-wallet/secure-storage";

import { createWalletSession } from "./create-session.js";

import type { WalletSession } from "./types.js";

export function createWallet(
  adapter: SecureStorageAdapter,
  options: SecureStorageOptions,
  crypto: WalletCrypto = new DefaultWalletCrypto(),
): WalletSession {
  const vault = createWalletVault(adapter, options);

  return createWalletSession(vault, crypto);
}