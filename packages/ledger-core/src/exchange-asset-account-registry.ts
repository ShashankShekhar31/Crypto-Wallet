import type { ExchangeAssetAccountRecord } from "./exchange-account-types.js";

export class ExchangeAssetAccountRegistry {
  private readonly assetAccounts = new Map<string, ExchangeAssetAccountRecord>();

  private readonly identities = new Map<string, string>();

  create(assetAccount: ExchangeAssetAccountRecord): ExchangeAssetAccountRecord {
    if (this.assetAccounts.has(assetAccount.id)) {
      throw new Error(`Exchange asset account already exists: ${assetAccount.id}`);
    }

    const identity = this.getIdentity(assetAccount);

    if (this.identities.has(identity)) {
      throw new Error("Exchange asset account already exists for exchange account and asset");
    }

    this.validate(assetAccount);

    const stored = Object.freeze({ ...assetAccount });

    this.assetAccounts.set(assetAccount.id, stored);
    this.identities.set(identity, assetAccount.id);

    return stored;
  }

  getById(id: string): ExchangeAssetAccountRecord | null {
    const assetAccount = this.assetAccounts.get(id);

    if (assetAccount === undefined) {
      return null;
    }

    return Object.freeze({ ...assetAccount });
  }

  private getIdentity(assetAccount: ExchangeAssetAccountRecord): string {
    return JSON.stringify([assetAccount.exchangeAccountId, assetAccount.assetId]);
  }

  private validate(assetAccount: ExchangeAssetAccountRecord): void {
    if (assetAccount.exchangeAccountId.trim().length === 0) {
      throw new Error("Exchange asset account exchange account ID must not be empty");
    }

    if (assetAccount.assetId.trim().length === 0) {
      throw new Error("Exchange asset account asset ID must not be empty");
    }

    if (assetAccount.networkId.trim().length === 0) {
      throw new Error("Exchange asset account network ID must not be empty");
    }
  }
}
