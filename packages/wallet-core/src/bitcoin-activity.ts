import type {
  BitcoinAddressType,
  BitcoinNetworkId,
  BitcoinProvider,
  BitcoinTransactionActivity,
  BitcoinTransactionActivityReader,
} from "@crypto-wallet/chain-core";

import type { WalletCrypto } from "@crypto-wallet/crypto";
import type { SecureVault } from "@crypto-wallet/secure-storage";

import { deriveBitcoinReceiveAddress } from "./receive-address.js";

export interface BitcoinActivityRequest {
  readonly provider: BitcoinProvider & BitcoinTransactionActivityReader;
  readonly network: BitcoinNetworkId;
  readonly addressType?: BitcoinAddressType;
  readonly account?: number;
  readonly change?: 0 | 1;
  readonly addressIndex?: number;
}

export async function getBitcoinActivity(
  vault: SecureVault,
  crypto: WalletCrypto,
  request: BitcoinActivityRequest,
): Promise<readonly BitcoinTransactionActivity[]> {
  if (request.provider.network !== request.network) {
    throw new Error("Bitcoin provider network does not match request network");
  }

  const addressType = request.addressType ?? "native-segwit";
  const account = request.account ?? 0;
  const change = request.change ?? 0;
  const addressIndex = request.addressIndex ?? 0;

  const address = await deriveBitcoinReceiveAddress(
    vault,
    (mnemonic) => crypto.mnemonic.toSeed(mnemonic),
    {
      network: request.network,
      addressType,
      account,
      change,
      addressIndex,
    },
  );

  return request.provider.getTransactions(address);
}
