import {
  bitcoinAddressToScriptPubKey,
  buildBitcoinTransaction,
  selectBitcoinUtxosWithFee,
  validateBitcoinAddress,
  type BitcoinAddressType,
  type BitcoinNetworkId,
  type BitcoinProvider,
  type BitcoinTransaction,
} from "@crypto-wallet/chain-core";

import type { WalletCrypto } from "@crypto-wallet/crypto";
import type { SecureVault } from "@crypto-wallet/secure-storage";

import { deriveBitcoinReceiveAddress } from "./receive-address.js";

export interface BitcoinSendRequest {
  readonly provider: BitcoinProvider;
  readonly network: BitcoinNetworkId;
  readonly recipient: string;
  readonly amount: bigint;
  readonly addressType?: BitcoinAddressType;
  readonly account?: number;
  readonly change?: 0 | 1;
  readonly addressIndex?: number;
}

export interface BitcoinSendPreview {
  readonly network: BitcoinNetworkId;
  readonly sourceAddress: string;
  readonly recipientAddress: string;
  readonly amount: bigint;
  readonly fee: bigint;
  readonly change: bigint;
  readonly virtualSize: number;
  readonly transaction: BitcoinTransaction;
}

export async function createBitcoinSendPreview(
  vault: SecureVault,
  crypto: WalletCrypto,
  request: BitcoinSendRequest,
): Promise<BitcoinSendPreview> {
  if (request.provider.network !== request.network) {
    throw new Error("Bitcoin provider network does not match request network");
  }

  const addressType = request.addressType ?? "native-segwit";
  const account = request.account ?? 0;
  const addressIndex = request.addressIndex ?? 0;

  const recipientAddress = validateBitcoinAddress(request.recipient, request.network);

  const sourceAddress = await deriveBitcoinReceiveAddress(
    vault,
    (mnemonic) => crypto.mnemonic.toSeed(mnemonic),
    {
      network: request.network,
      addressType,
      account,
      change: request.change ?? 0,
      addressIndex,
    },
  );

  const utxos = await request.provider.getUtxos(sourceAddress);
  const feeEstimate = await request.provider.estimateFee();

  const selection = selectBitcoinUtxosWithFee(
    utxos,
    request.amount,
    addressType,
    feeEstimate.satoshisPerVbyte,
  );

  const recipientScriptPubKey = bitcoinAddressToScriptPubKey(recipientAddress, request.network);

  const changeAddress = await deriveBitcoinReceiveAddress(
    vault,
    (mnemonic) => crypto.mnemonic.toSeed(mnemonic),
    {
      network: request.network,
      addressType,
      account,
      change: 1,
      addressIndex,
    },
  );

  const changeScriptPubKey = bitcoinAddressToScriptPubKey(changeAddress, request.network);

  const built = buildBitcoinTransaction({
    network: request.network,
    inputs: selection.selected,
    amount: request.amount,
    recipientScriptPubKey,
    changeScriptPubKey,
    addressType,
    satoshisPerVbyte: feeEstimate.satoshisPerVbyte,
  });

  return Object.freeze({
    network: request.network,
    sourceAddress,
    recipientAddress,
    amount: request.amount,
    fee: built.fee,
    change: built.change,
    virtualSize: built.virtualSize,
    transaction: built.transaction,
  });
}
