import {
  bitcoinAddressToScriptPubKey,
  createBitcoinPsbt,
  deriveBitcoinAddress,
  deriveBitcoinAddressKey,
  getBitcoinTransactionId,
  signBitcoinPsbt,
  type BitcoinAddressType,
  type BitcoinNetworkId,
  type BitcoinTransaction,
} from "@crypto-wallet/chain-core";

import type { WalletCrypto } from "@crypto-wallet/crypto";
import type { SecureVault } from "@crypto-wallet/secure-storage";

import { MNEMONIC_STORAGE_KEY } from "./wallet-lifecycle.js";

export interface BitcoinSendSigningRequest {
  readonly network: BitcoinNetworkId;
  readonly transaction: BitcoinTransaction;
  readonly addressType?: BitcoinAddressType;
  readonly account?: number;
  readonly change?: 0 | 1;
  readonly addressIndex?: number;
}

export interface BitcoinSignedTransaction {
  readonly network: BitcoinNetworkId;
  readonly transaction: BitcoinTransaction;
  readonly rawTransaction: Uint8Array;
  readonly txid: string;
}

export async function signBitcoinTransaction(
  vault: SecureVault,
  crypto: WalletCrypto,
  request: BitcoinSendSigningRequest,
): Promise<BitcoinSignedTransaction> {
  if (vault.state.locked) {
    throw new Error("Wallet is locked");
  }

  if (request.transaction.network !== request.network) {
    throw new Error("Bitcoin transaction network does not match signing request");
  }

  const mnemonicBytes = vault.get(MNEMONIC_STORAGE_KEY);

  if (mnemonicBytes === null) {
    throw new Error("Wallet mnemonic is unavailable");
  }

  const mnemonic = new TextDecoder().decode(mnemonicBytes);
  const seed = await crypto.mnemonic.toSeed(mnemonic);

  let derivedKey: ReturnType<typeof deriveBitcoinAddressKey>["key"] | null = null;

  try {
    const derived = deriveBitcoinAddressKey(
      seed,
      request.addressType ?? "native-segwit",
      request.network,
      request.account ?? 0,
      request.change ?? 0,
      request.addressIndex ?? 0,
    );

    derivedKey = derived.key;

    const sourceAddress = deriveBitcoinAddress(
      seed,
      request.addressType ?? "native-segwit",
      request.network,
      request.account ?? 0,
      request.change ?? 0,
      request.addressIndex ?? 0,
    );

    const expectedScriptPubKey = bitcoinAddressToScriptPubKey(sourceAddress, request.network);

    for (const input of request.transaction.inputs) {
      if (
        input.previousOutput.scriptPubKey.length !== expectedScriptPubKey.length ||
        input.previousOutput.scriptPubKey.some(
          (byte, index) => byte !== expectedScriptPubKey[index],
        )
      ) {
        throw new Error("Bitcoin transaction input does not belong to the wallet");
      }
    }

    const psbt = createBitcoinPsbt(request.transaction);
    const rawTransaction = signBitcoinPsbt(psbt.serialized, derivedKey);
    const txid = getBitcoinTransactionId(rawTransaction);

    return Object.freeze({
      network: request.network,
      transaction: request.transaction,
      rawTransaction,
      txid,
    });
  } finally {
    seed.wipe();
    derivedKey?.wipe();
  }
}
