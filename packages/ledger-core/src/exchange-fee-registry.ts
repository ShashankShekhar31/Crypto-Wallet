import type { ExchangeFeeRecord } from "./exchange-fee-types.js";

export class ExchangeFeeRegistry {
  private readonly fees = new Map<string, ExchangeFeeRecord>();
  private readonly references = new Map<string, string>();

  create(fee: ExchangeFeeRecord): ExchangeFeeRecord {
    if (this.fees.has(fee.id)) {
      throw new Error(`Exchange fee already exists: ${fee.id}`);
    }

    if (this.references.has(fee.reference)) {
      throw new Error(`Exchange fee reference already exists: ${fee.reference}`);
    }

    this.validate(fee);

    const stored = Object.freeze({ ...fee });

    this.fees.set(fee.id, stored);
    this.references.set(fee.reference, fee.id);

    return stored;
  }

  getById(id: string): ExchangeFeeRecord | null {
    const fee = this.fees.get(id);

    if (fee === undefined) {
      return null;
    }

    return Object.freeze({ ...fee });
  }

  private validate(fee: ExchangeFeeRecord): void {
    if (fee.tradeId.trim().length === 0) {
      throw new Error("Exchange fee trade ID must not be empty");
    }

    if (fee.sourceExchangeAssetAccountId.trim().length === 0) {
      throw new Error("Exchange fee source asset account ID must not be empty");
    }

    if (fee.feeExchangeAssetAccountId.trim().length === 0) {
      throw new Error("Exchange fee fee account ID must not be empty");
    }

    if (fee.sourceExchangeAssetAccountId === fee.feeExchangeAssetAccountId) {
      throw new Error("Exchange fee source and fee accounts must differ");
    }

    if (fee.assetId.trim().length === 0) {
      throw new Error("Exchange fee asset ID must not be empty");
    }

    if (!/^[0-9]+$/.test(fee.amount) || BigInt(fee.amount) <= 0n) {
      throw new Error("Exchange fee amount must be positive");
    }

    if (fee.reference.trim().length === 0) {
      throw new Error("Exchange fee reference must not be empty");
    }
  }
}
