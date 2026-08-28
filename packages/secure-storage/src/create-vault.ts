import { WebCryptoVaultCipher } from "./web-crypto-vault-cipher.js";
import { WalletVault } from "./vault.js";
import type {
  SecureStorageAdapter,
  SecureStorageOptions,
  SecureVault,
} from "./types.js";

export function createWalletVault(
  adapter: SecureStorageAdapter,
  options: SecureStorageOptions,
): SecureVault {
  return new WalletVault(
    adapter,
    new WebCryptoVaultCipher(),
    options,
  );
}