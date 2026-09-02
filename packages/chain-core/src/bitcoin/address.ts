import { base58check } from "@scure/base";
import { sha256 } from "@noble/hashes/sha2.js";
import type { BitcoinNetworkId } from "./types.js";

import { bech32, createBase58check } from "@scure/base";

import { ripemd160 } from "@noble/hashes/legacy.js";

import { deriveBitcoinAddressKey } from "./derivation.js";

import type { SecretBytes } from "@crypto-wallet/crypto";

function normalizeAddress(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("Bitcoin address is required");
  }

  return normalized;
}

function isBech32Address(value: string, network: BitcoinNetworkId): boolean {
  const prefix = network === "bitcoin-mainnet" ? "bc1" : "tb1";

  return value.toLowerCase().startsWith(prefix);
}

function isBase58Address(value: string, network: BitcoinNetworkId): boolean {
  try {
    const decoded = base58check(sha256).decode(value);

    const version = decoded[0];

    if (version === undefined) {
      return false;
    }

    if (network === "bitcoin-mainnet") {
      return version === 0x00 || version === 0x05;
    }

    return version === 0x6f || version === 0xc4;
  } catch {
    return false;
  }
}

export function isValidBitcoinAddress(value: string, network: BitcoinNetworkId): boolean {
  const normalized = normalizeAddress(value);

  return isBech32Address(normalized, network) || isBase58Address(normalized, network);
}

export function validateBitcoinAddress(value: string, network: BitcoinNetworkId): string {
  const normalized = normalizeAddress(value);

  if (!isValidBitcoinAddress(normalized, network)) {
    throw new Error(`Invalid Bitcoin address for ${network}`);
  }

  return normalized;
}

import type { BitcoinAddressType } from "./derivation.js";

function hash160(value: Uint8Array): Uint8Array {
  return ripemd160(sha256(value));
}

function validateCompressedPublicKey(publicKey: Uint8Array): void {
  if (publicKey.length !== 33) {
    throw new Error("Bitcoin public key must be 33 bytes");
  }

  const prefix = publicKey[0];

  if (prefix !== 0x02 && prefix !== 0x03) {
    throw new Error("Bitcoin public key must be compressed");
  }
}

export function bitcoinAddressFromPublicKey(
  publicKey: Uint8Array,
  addressType: BitcoinAddressType,
  network: BitcoinNetworkId,
): string {
  validateCompressedPublicKey(publicKey);

  const publicKeyHash = hash160(publicKey);

  if (addressType === "legacy") {
    const version = network === "bitcoin-mainnet" ? 0x00 : 0x6f;

    const payload = new Uint8Array(1 + publicKeyHash.length);

    payload[0] = version;
    payload.set(publicKeyHash, 1);

    return createBase58check(sha256).encode(payload);
  }

  const prefix = network === "bitcoin-mainnet" ? "bc" : "tb";

  const words = [0, ...bech32.toWords(publicKeyHash)];

  return bech32.encode(prefix, words);
}

export function deriveBitcoinAddress(
  seed: SecretBytes,
  addressType: BitcoinAddressType,
  network: BitcoinNetworkId,
  account = 0,
  change: 0 | 1 = 0,
  addressIndex = 0,
): string {
  const derived = deriveBitcoinAddressKey(
    seed,
    addressType,
    network,
    account,
    change,
    addressIndex,
  );

  try {
    return bitcoinAddressFromPublicKey(derived.key.publicKey(), addressType, network);
  } finally {
    derived.key.wipe();
  }
}
