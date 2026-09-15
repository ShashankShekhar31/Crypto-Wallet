import type { DerivedKey, WalletCrypto } from "@crypto-wallet/crypto";

import type { CustodySignRequest, CustodySignature, KeyReference } from "./key-management.js";

import type { ManagedKeyProvider } from "./key-management-provider.js";

export interface LocalKeyManagementKey {
  readonly reference: KeyReference;
  readonly key: DerivedKey;
}

export class LocalKeyManagementProvider implements ManagedKeyProvider {
  readonly metadata = Object.freeze({
    type: "local" as const,
    productionReady: false,
    managesPrivateKeyMaterial: false,
  });

  private readonly keys = new Map<string, LocalKeyManagementKey>();

  constructor(
    private readonly crypto: WalletCrypto,
    keys: readonly LocalKeyManagementKey[],
  ) {
    for (const entry of keys) {
      if (this.keys.has(entry.reference.id)) {
        throw new Error(`Duplicate custody key reference: ${entry.reference.id}`);
      }

      this.keys.set(entry.reference.id, entry);
    }
  }

  async getPublicKey(key: KeyReference): Promise<Uint8Array> {
    const entry = this.getKey(key);

    return new Uint8Array(entry.key.publicKey());
  }

  async sign(request: CustodySignRequest): Promise<CustodySignature> {
    const entry = this.getKey(request.key);

    if (request.payload.byteLength !== 32) {
      throw new Error("Custody signing payload must be exactly 32 bytes");
    }

    const digest = new Uint8Array(request.payload);

    try {
      const signature = this.crypto.signer.signDigest(entry.key, digest);

      return Object.freeze({
        keyId: entry.reference.id,
        chain: request.chain,
        signature: new Uint8Array([...signature.compact, signature.recovery]),
      });
    } finally {
      digest.fill(0);
    }
  }

  private getKey(reference: KeyReference): LocalKeyManagementKey {
    const entry = this.keys.get(reference.id);

    if (entry === undefined) {
      throw new Error(`Custody key not found: ${reference.id}`);
    }

    if (entry.reference.tier !== reference.tier) {
      throw new Error(`Custody key tier mismatch: ${reference.id}`);
    }

    return entry;
  }
}
