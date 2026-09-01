import type { DerivedKey, WalletSigner } from "@crypto-wallet/crypto";

import { createEip1559SigningDigest } from "./transaction-signing.js";

import type { EvmTransactionSignature } from "./signed-transaction.js";

import type { EvmUnsignedTransaction } from "./transaction.js";

export interface EvmTransactionSigner {
  signTransaction(
    transaction: EvmUnsignedTransaction,
    key: DerivedKey,
  ): Promise<EvmTransactionSignature>;
}

export class DefaultEvmTransactionSigner implements EvmTransactionSigner {
  constructor(private readonly walletSigner: WalletSigner) {}

  async signTransaction(
    transaction: EvmUnsignedTransaction,
    key: DerivedKey,
  ): Promise<EvmTransactionSignature> {
    const digest = createEip1559SigningDigest(transaction);

    const signature = this.walletSigner.signDigest(key, digest);

    return Object.freeze({
      compact: new Uint8Array(signature.compact),
      recovery: signature.recovery,
    });
  }
}
