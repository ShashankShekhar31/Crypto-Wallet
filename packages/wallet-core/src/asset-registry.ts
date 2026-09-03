import type { Asset } from "@crypto-wallet/shared-types";

export type AssetDefinition = Asset;

export interface AssetRegistry {
  register(asset: AssetDefinition): void;

  getById(id: string): AssetDefinition | null;

  list(): AssetDefinition[];
}

export class DefaultAssetRegistry implements AssetRegistry {
  private readonly assets = new Map<string, AssetDefinition>();

  register(asset: AssetDefinition): void {
    if (this.assets.has(asset.id)) {
      throw new Error(`Asset already registered: ${asset.id}`);
    }

    this.assets.set(asset.id, asset);
  }

  getById(id: string): AssetDefinition | null {
    return this.assets.get(id) ?? null;
  }

  list(): AssetDefinition[] {
    return [...this.assets.values()];
  }
}
