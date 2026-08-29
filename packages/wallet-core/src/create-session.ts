import type { SecureVault } from "@crypto-wallet/secure-storage";

import { DefaultWalletSession } from "./session.js";
import type { WalletSession } from "./types.js";

export function createWalletSession(
  vault: SecureVault,
): WalletSession {
  return new DefaultWalletSession(vault);
}