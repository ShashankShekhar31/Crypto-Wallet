import { secp256k1 } from "@noble/curves/secp256k1.js";
import { describe, expect, it } from "vitest";

import { Bip32WalletKeyDeriver } from "../bip32-derivation.js";
import { Secp256k1WalletSigner } from "../secp256k1-signer.js";
import { ManagedSecretBytes } from "../secret-bytes.js";

describe("Secp256k1WalletSigner", () => {
  const deriver = new Bip32WalletKeyDeriver();
  const signer = new Secp256k1WalletSigner();

  it("signs a 32-byte digest", () => {
    const seed = new ManagedSecretBytes(
      Uint8Array.from(Array.from({ length: 32 }, (_, index) => index)),
    );

    const key = deriver.fromSeed(seed);

    const digest = new Uint8Array(32);
    digest.fill(0x42);

    const signature = signer.signDigest(key, digest);

    expect(signature.compact).toHaveLength(64);
    expect(signature.recovery).toBeGreaterThanOrEqual(0);
    expect(signature.recovery).toBeLessThanOrEqual(3);

    key.wipe();
    seed.wipe();
  });

  it("produces a signature that verifies with the derived public key", () => {
    const seed = new ManagedSecretBytes(
      Uint8Array.from(Array.from({ length: 32 }, (_, index) => index)),
    );

    const key = deriver.fromSeed(seed);

    const digest = new Uint8Array(32);
    digest.fill(0x42);

    const signature = signer.signDigest(key, digest);
    const publicKey = key.publicKey();

    expect(
      secp256k1.verify(signature.compact, digest, publicKey, {
        prehash: false,
      }),
    ).toBe(true);

    const recoveredPublicKey = secp256k1.recoverPublicKey(
      Uint8Array.from([signature.recovery, ...signature.compact]),
      digest,
      {
        prehash: false,
      },
    );

    expect(recoveredPublicKey).toEqual(publicKey);

    key.wipe();
    seed.wipe();
  });

  it("produces deterministic signatures for the same key and digest", () => {
    const seed = new ManagedSecretBytes(
      Uint8Array.from(Array.from({ length: 32 }, (_, index) => index)),
    );

    const key = deriver.fromSeed(seed);

    const digest = new Uint8Array(32);
    digest.fill(0x42);

    const first = signer.signDigest(key, digest);
    const second = signer.signDigest(key, digest);

    expect(first.compact).toEqual(second.compact);
    expect(first.recovery).toBe(second.recovery);

    key.wipe();
    seed.wipe();
  });

  it("rejects digests that are not exactly 32 bytes", () => {
    const seed = new ManagedSecretBytes(
      Uint8Array.from(Array.from({ length: 32 }, (_, index) => index)),
    );

    const key = deriver.fromSeed(seed);

    expect(() => signer.signDigest(key, new Uint8Array(31))).toThrow(
      "Digest must be exactly 32 bytes",
    );

    expect(() => signer.signDigest(key, new Uint8Array(33))).toThrow(
      "Digest must be exactly 32 bytes",
    );

    key.wipe();
    seed.wipe();
  });

  it("does not expose the private key through the signature", () => {
    const seed = new ManagedSecretBytes(
      Uint8Array.from(Array.from({ length: 32 }, (_, index) => index)),
    );

    const key = deriver.fromSeed(seed);

    const digest = new Uint8Array(32);
    digest.fill(0x42);

    const signature = signer.signDigest(key, digest);
    const privateKey = key.privateKey().copy();

    expect(signature.compact).not.toEqual(privateKey);

    privateKey.fill(0);
    key.wipe();
    seed.wipe();
  });
});
