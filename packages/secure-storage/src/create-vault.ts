import { WebCryptoVaultCipher } from "./web-crypto-vault-cipher.js";
import { WalletVault } from "./vault.js";

import type {
  SecureStorageAdapter,
  SecureStorageOptions,
  SecureVault,
  VaultCipher,
} from "./types.js";

export function createWalletVault(
  adapter: SecureStorageAdapter,
  options: SecureStorageOptions,
  cipher: VaultCipher = new WebCryptoVaultCipher(),
): SecureVault {
  return new WalletVault(adapter, cipher, options);
}
