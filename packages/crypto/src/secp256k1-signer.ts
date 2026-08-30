import { secp256k1 } from "@noble/curves/secp256k1.js";

import type {
  DerivedKey,
  WalletSigner,
} from "./wallet-crypto-types.js";

export class Secp256k1WalletSigner implements WalletSigner {
  signDigest(key: DerivedKey, digest: Uint8Array): Uint8Array {
    if (digest.byteLength !== 32) {
      throw new Error("Digest must be exactly 32 bytes");
    }

    const privateKey = key.privateKey();

    try {
      const privateKeyBytes = privateKey.copy();

      try {
        const signature = secp256k1.sign(digest, privateKeyBytes);

        return new Uint8Array(signature);
      } finally {
        privateKeyBytes.fill(0);
      }
    } finally {
      privateKey.wipe();
    }
  }
}