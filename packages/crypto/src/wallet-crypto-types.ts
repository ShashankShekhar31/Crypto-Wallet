/**
 * Wallet cryptographic core contracts.
 *
 * These interfaces intentionally hide the underlying cryptographic
 * implementation. Callers must not depend directly on @scure/bip39
 * or @scure/bip32 types.
 */

export type MnemonicStrength = 128 | 160 | 192 | 224 | 256;

export interface MnemonicService {
  generate(strength?: MnemonicStrength): string;

  validate(mnemonic: string): boolean;

  toSeed(mnemonic: string, passphrase?: string): Promise<SecretBytes>;
}

export interface SecretBytes {
  /**
   * Returns a defensive copy of the secret bytes.
   *
   * Callers are responsible for wiping the returned copy when
   * it is no longer needed.
   */
  copy(): Uint8Array;

  /**
   * Permanently clears this secret's owned byte buffer.
   */
  wipe(): void;

  /**
   * Indicates whether this secret has already been wiped.
   */
  readonly isWiped: boolean;
}

export interface DerivationPath {
  readonly value: string;
}

export function createDerivationPath(value: string): DerivationPath {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("Derivation path is required");
  }

  if (!/^m(?:\/[0-9]+'?)*$/.test(normalized)) {
    throw new Error("Invalid BIP-32 derivation path");
  }

  return Object.freeze({
    value: normalized,
  });
}

export interface Bip44DerivationPath extends DerivationPath {
  readonly value: `m/${number}'/${number}'/${number}'/${number}/${number}`;
}

export function createBip44DerivationPath(
  purpose: number,
  coinType: number,
  account: number,
  change: number,
  addressIndex: number,
): Bip44DerivationPath {
  const components = [purpose, coinType, account, change, addressIndex];

  for (const component of components) {
    if (!Number.isInteger(component) || component < 0) {
      throw new Error("BIP-44 path components must be non-negative integers");
    }

    if (component >= 2 ** 31) {
      throw new Error("BIP-44 path component exceeds BIP-32 index range");
    }
  }

  if (change > 1) {
    throw new Error("BIP-44 change must be 0 or 1");
  }

  const value = `m/${purpose}'/${coinType}'/${account}'/${change}/${addressIndex}` as const;

  return Object.freeze({ value });
}

export interface DerivedKey {
  /**
   * Returns a defensive copy of the private key.
   *
   * Implementations must not expose their internal private-key buffer.
   */
  privateKey(): SecretBytes;

  /**
   * Returns a defensive copy of the public key.
   */
  publicKey(): Uint8Array;

  /**
   * Explicitly wipes private key material held by this derived key.
   */
  wipe(): void;
}

export interface WalletKeyDeriver {
  /**
   * Creates the root HD key from BIP-39 seed material.
   */
  fromSeed(seed: SecretBytes): DerivedKey;

  /**
   * Derives a child key from an existing derived key.
   */
  derive(parent: DerivedKey, path: DerivationPath): DerivedKey;
}

export interface WalletSigner {
  /**
   * Signs a 32-byte message digest using the supplied derived key.
   */
  signDigest(key: DerivedKey, digest: Uint8Array): Uint8Array;
}

export interface WalletCrypto {
  readonly mnemonic: MnemonicService;
  readonly deriver: WalletKeyDeriver;
  readonly signer: WalletSigner;
}
