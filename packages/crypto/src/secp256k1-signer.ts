import { secp256k1 } from "@noble/curves/secp256k1.js";

import type {
  DerivedKey,
  WalletSignature,
  WalletSigner,
} from "./wallet-crypto-types.js";

export class Secp256k1WalletSigner implements WalletSigner {
  signDigest(
    key: DerivedKey,
    digest: Uint8Array,
  ): WalletSignature {
    if (digest.byteLength !== 32) {
      throw new Error("Digest must be exactly 32 bytes");
    }

    const privateKey = key.privateKey();

    try {
      const privateKeyBytes = privateKey.copy();

      try {
        const recoveredSignature = secp256k1.sign(
          digest,
          privateKeyBytes,
          {
            prehash: false,
            format: "recovered",
          },
        );

        if (recoveredSignature.length !== 65) {
          throw new Error(
            "Invalid recovered secp256k1 signature",
          );
        }

        const recovery = recoveredSignature[0];

        if (recovery === undefined || recovery > 3) {
          throw new Error(
            "Invalid secp256k1 recovery identifier",
          );
        }

        return Object.freeze({
          compact: new Uint8Array(
            recoveredSignature.slice(1),
          ),
          recovery,
        });
      } finally {
        privateKeyBytes.fill(0);
      }
    } finally {
      privateKey.wipe();
    }
  }
}