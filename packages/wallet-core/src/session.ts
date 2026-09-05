import type { WalletCrypto } from "@crypto-wallet/crypto";

import type { SecureVault, VaultState } from "@crypto-wallet/secure-storage";

import { DefaultWalletLifecycle, type WalletLifecycle } from "./wallet-lifecycle.js";

import type { WalletSession } from "./types.js";

import {
  deriveBitcoinReceiveAddress,
  type BitcoinReceiveAddressOptions,
} from "./receive-address.js";

import {
  createBitcoinSendPreview,
  type BitcoinSendPreview,
  type BitcoinSendRequest,
} from "./bitcoin-send.js";

import {
  signBitcoinTransaction,
  type BitcoinSignedTransaction,
  type BitcoinSendSigningRequest,
} from "./bitcoin-send-signing.js";

import { getBitcoinActivity, type BitcoinActivityRequest } from "./bitcoin-activity.js";

import type { BitcoinTransactionActivity } from "@crypto-wallet/chain-core";

export class DefaultWalletSession implements WalletSession {
  readonly lifecycle: WalletLifecycle;

  async getBitcoinReceiveAddress(options: BitcoinReceiveAddressOptions): Promise<string> {
    if (this.vault.state.locked) {
      throw new Error("Wallet is locked");
    }

    return deriveBitcoinReceiveAddress(
      this.vault,
      (mnemonic) => this.crypto.mnemonic.toSeed(mnemonic),
      options,
    );
  }

  async createBitcoinSendPreview(request: BitcoinSendRequest): Promise<BitcoinSendPreview> {
    if (this.vault.state.locked) {
      throw new Error("Wallet is locked");
    }

    return createBitcoinSendPreview(this.vault, this.crypto, request);
  }

  async signBitcoinTransaction(
    request: BitcoinSendSigningRequest,
  ): Promise<BitcoinSignedTransaction> {
    if (this.vault.state.locked) {
      throw new Error("Wallet is locked");
    }

    return signBitcoinTransaction(this.vault, this.crypto, request);
  }

  async getBitcoinActivity(
    request: BitcoinActivityRequest,
  ): Promise<readonly BitcoinTransactionActivity[]> {
    if (this.vault.state.locked) {
      throw new Error("Wallet is locked");
    }

    return getBitcoinActivity(this.vault, this.crypto, request);
  }

  constructor(
    readonly vault: SecureVault,
    readonly crypto: WalletCrypto,
  ) {
    this.lifecycle = new DefaultWalletLifecycle(vault, crypto);
  }

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
