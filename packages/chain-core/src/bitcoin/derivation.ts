import { Bip32WalletKeyDeriver, createBip44DerivationPath } from "@crypto-wallet/crypto";

import type { DerivedKey, SecretBytes } from "@crypto-wallet/crypto";

import type { BitcoinNetworkId } from "./types.js";

export type BitcoinAddressType = "legacy" | "native-segwit";

export interface BitcoinDerivationPath {
  readonly purpose: 44 | 84;
  readonly account: number;
  readonly change: 0 | 1;
  readonly addressIndex: number;
}

export interface BitcoinDerivedAddressKey {
  readonly key: DerivedKey;
  readonly path: string;
}

function validateIndex(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0 || value >= 2 ** 31) {
    throw new Error(`Bitcoin ${field} must be a valid BIP-32 index`);
  }
}

function getPurpose(addressType: BitcoinAddressType): 44 | 84 {
  if (addressType === "legacy") {
    return 44;
  }

  return 84;
}

function getCoinType(network: BitcoinNetworkId): number {
  if (network === "bitcoin-mainnet") {
    return 0;
  }

  return 1;
}

function createPath(
  addressType: BitcoinAddressType,
  network: BitcoinNetworkId,
  account: number,
  change: 0 | 1,
  addressIndex: number,
): string {
  validateIndex(account, "account");
  validateIndex(addressIndex, "address index");

  const purpose = getPurpose(addressType);
  const coinType = getCoinType(network);

  return createBip44DerivationPath(purpose, coinType, account, change, addressIndex).value;
}

export function deriveBitcoinAddressKey(
  seed: SecretBytes,
  addressType: BitcoinAddressType,
  network: BitcoinNetworkId,
  account = 0,
  change: 0 | 1 = 0,
  addressIndex = 0,
): BitcoinDerivedAddressKey {
  const path = createPath(addressType, network, account, change, addressIndex);

  const deriver = new Bip32WalletKeyDeriver();

  const root = deriver.fromSeed(seed);

  try {
    const key = deriver.derive(root, {
      value: path,
    });

    return Object.freeze({
      key,
      path,
    });
  } finally {
    root.wipe();
  }
}
