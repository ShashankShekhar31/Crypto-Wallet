import { sha256 } from "@noble/hashes/sha2.js";
import { ripemd160 } from "@noble/hashes/legacy.js";
import { base58check, bech32, createBase58check } from "@scure/base";

import type { SecretBytes } from "@crypto-wallet/crypto";

import { deriveBitcoinAddressKey } from "./derivation.js";
import type { BitcoinAddressType } from "./derivation.js";
import type { BitcoinNetworkId } from "./types.js";

function normalizeAddress(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("Bitcoin address is required");
  }

  return normalized;
}

function isValidBase58Address(value: string, network: BitcoinNetworkId): boolean {
  try {
    const decoded = base58check(sha256).decode(value);

    if (decoded.length !== 21) {
      return false;
    }

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

function isValidBech32Address(value: string, network: BitcoinNetworkId): boolean {
  try {
    const decoded = bech32.decode(value);

    const expectedPrefix = network === "bitcoin-mainnet" ? "bc" : "tb";

    if (decoded.prefix !== expectedPrefix) {
      return false;
    }

    const [version, ...programWords] = decoded.words;

    if (version === undefined) {
      return false;
    }

    // MVP currently supports SegWit v0 / native SegWit.
    if (version !== 0) {
      return false;
    }

    const program = bech32.fromWords(programWords);

    // P2WPKH = 20 bytes.
    // P2WSH = 32 bytes.
    if (program.length !== 20 && program.length !== 32) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function isValidBitcoinAddress(value: string, network: BitcoinNetworkId): boolean {
  const normalized = normalizeAddress(value);

  return isValidBase58Address(normalized, network) || isValidBech32Address(normalized, network);
}

export function validateBitcoinAddress(value: string, network: BitcoinNetworkId): string {
  const normalized = normalizeAddress(value);

  if (!isValidBitcoinAddress(normalized, network)) {
    throw new Error(`Invalid Bitcoin address for ${network}`);
  }

  return normalized;
}

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

export function bitcoinAddressToScriptPubKey(
  address: string,
  network: BitcoinNetworkId,
): Uint8Array {
  const normalized = validateBitcoinAddress(address, network);

  if (isValidBech32Address(normalized, network)) {
    const decoded = bech32.decode(normalized);

    const [version, ...programWords] = decoded.words;

    if (version !== 0) {
      throw new Error("Unsupported Bitcoin SegWit version");
    }

    const program = bech32.fromWords(programWords);

    const script = new Uint8Array(2 + program.length);

    script[0] = 0x00;
    script[1] = program.length;

    script.set(program, 2);

    return script;
  }

  const decoded = base58check(sha256).decode(normalized);

  const version = decoded[0];

  if (version === undefined) {
    throw new Error("Invalid Bitcoin address payload");
  }

  const hash = decoded.slice(1);

  if (hash.length !== 20) {
    throw new Error("Invalid Bitcoin address hash length");
  }

  if (version === 0x00 || version === 0x6f) {
    const script = new Uint8Array(25);

    script[0] = 0x76;
    script[1] = 0xa9;
    script[2] = 0x14;
    script.set(hash, 3);
    script[23] = 0x88;
    script[24] = 0xac;

    return script;
  }

  if (version === 0x05 || version === 0xc4) {
    const script = new Uint8Array(23);

    script[0] = 0xa9;
    script[1] = 0x14;
    script.set(hash, 2);
    script[22] = 0x87;

    return script;
  }

  throw new Error("Unsupported Bitcoin address type");
}
