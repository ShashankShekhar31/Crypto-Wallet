import { HDKey } from "@scure/bip32";

import { ManagedSecretBytes } from "./secret-bytes.js";
import type {
  DerivedKey,
  DerivationPath,
  SecretBytes,
  WalletKeyDeriver,
} from "./wallet-crypto-types.js";

class ScureDerivedKey implements DerivedKey {
  constructor(private readonly key: HDKey) {}

  privateKey(): SecretBytes {
    const privateKey = this.key.privateKey;

    if (privateKey === null) {
      throw new Error("Private key is not available");
    }

    return new ManagedSecretBytes(privateKey);
  }

  publicKey(): Uint8Array {
    const publicKey = this.key.publicKey;

    if (publicKey === null) {
      throw new Error("Public key is not available");
    }

    return new Uint8Array(publicKey);
  }

  wipe(): void {
    this.key.wipePrivateData();
  }

  get underlying(): HDKey {
    return this.key;
  }
}

export class Bip32WalletKeyDeriver implements WalletKeyDeriver {
  fromSeed(seed: SecretBytes): DerivedKey {
    const seedBytes = seed.copy();

    try {
      return new ScureDerivedKey(HDKey.fromMasterSeed(seedBytes));
    } finally {
      seedBytes.fill(0);
    }
  }

  derive(parent: DerivedKey, path: DerivationPath): DerivedKey {
    if (!(parent instanceof ScureDerivedKey)) {
      throw new Error("Unsupported derived key implementation");
    }

    if (!path.value.trim()) {
      throw new Error("Derivation path is required");
    }

    return new ScureDerivedKey(parent.underlying.derive(path.value));
  }
}