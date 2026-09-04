import {
  deriveBitcoinAddress,
  type BitcoinAddressType,
  type BitcoinNetworkId,
} from "@crypto-wallet/chain-core";

import type { SecretBytes } from "@crypto-wallet/crypto";

import type { SecureVault } from "@crypto-wallet/secure-storage";

import { MNEMONIC_STORAGE_KEY } from "./wallet-lifecycle.js";

export interface BitcoinReceiveAddressOptions {
  readonly network: BitcoinNetworkId;
  readonly addressType?: BitcoinAddressType;
  readonly account?: number;
  readonly change?: 0 | 1;
  readonly addressIndex?: number;
}

export async function deriveBitcoinReceiveAddress(
  vault: SecureVault,
  mnemonicToSeed: (mnemonic: string) => Promise<SecretBytes>,
  options: BitcoinReceiveAddressOptions,
): Promise<string> {
  const mnemonicBytes = vault.get(MNEMONIC_STORAGE_KEY);

  if (mnemonicBytes === null) {
    throw new Error("Wallet mnemonic is unavailable");
  }

  const mnemonic = new TextDecoder().decode(mnemonicBytes);

  const seed = await mnemonicToSeed(mnemonic);

  try {
    return deriveBitcoinAddress(
      seed,
      options.addressType ?? "native-segwit",
      options.network,
      options.account ?? 0,
      options.change ?? 0,
      options.addressIndex ?? 0,
    );
  } finally {
    seed.wipe();
  }
}
