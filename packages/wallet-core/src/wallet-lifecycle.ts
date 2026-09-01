import type { WalletCrypto } from "@crypto-wallet/crypto";

import type { SecureVault } from "@crypto-wallet/secure-storage";

const MNEMONIC_STORAGE_KEY = "wallet-core:mnemonic";

/**
 * Result of creating a new wallet.
 *
 * The mnemonic is returned to the caller so the presentation
 * layer can display it for backup. Callers must never log,
 * transmit, or persist the mnemonic outside the secure vault
 * unless explicitly required by the wallet backup flow.
 */

export interface WalletCreationResult {
  readonly mnemonic: string;
}

/**
 * Restores a wallet from a BIP-39 recovery mnemonic.
 *
 * The mnemonic is validated before it is written to the vault.
 */

export interface WalletLifecycle {
  create(password: string): Promise<WalletCreationResult>;
  restore(password: string, mnemonic: string): Promise<void>;
}

export class DefaultWalletLifecycle implements WalletLifecycle {
  constructor(
    private readonly vault: SecureVault,
    private readonly crypto: WalletCrypto,
  ) {}

  /**
   * Creates a new wallet and returns its recovery mnemonic.
   *
   * The mnemonic is returned to the caller exactly so it can be
   * presented to the user for backup and verification.
  */

  async create(password: string): Promise<WalletCreationResult> {
    await this.vault.unlock(password);

    if (this.vault.get(MNEMONIC_STORAGE_KEY) !== null) {
      throw new Error("Wallet already exists");
    }

    const mnemonic = this.crypto.mnemonic.generate();

    this.vault.set(MNEMONIC_STORAGE_KEY, new TextEncoder().encode(mnemonic));

    await this.vault.persist();

    return {
      mnemonic,
    };
  }

  /**
   * Restores a wallet from a BIP-39 recovery mnemonic.
   *
   * The mnemonic is validated before it is written to the vault.
  */

  async restore(password: string, mnemonic: string): Promise<void> {
    if (!this.crypto.mnemonic.validate(mnemonic)) {
      throw new Error("Invalid wallet mnemonic");
    }

    await this.vault.unlock(password);

    if (this.vault.get(MNEMONIC_STORAGE_KEY) !== null) {
      throw new Error("Wallet already exists");
    }

    this.vault.set(MNEMONIC_STORAGE_KEY, new TextEncoder().encode(mnemonic));

    await this.vault.persist();
  }
}

export { MNEMONIC_STORAGE_KEY };
