import type { ExchangeWithdrawalRecord } from "./exchange-withdrawal-types.js";

export class ExchangeWithdrawalRegistry {
  private readonly withdrawals = new Map<string, ExchangeWithdrawalRecord>();

  private readonly references = new Map<string, string>();

  create(withdrawal: ExchangeWithdrawalRecord): ExchangeWithdrawalRecord {
    if (this.withdrawals.has(withdrawal.id)) {
      throw new Error(`Exchange withdrawal already exists: ${withdrawal.id}`);
    }

    if (this.references.has(withdrawal.reference)) {
      throw new Error(`Exchange withdrawal reference already exists: ${withdrawal.reference}`);
    }

    this.validate(withdrawal);

    const stored = Object.freeze({ ...withdrawal });

    this.withdrawals.set(withdrawal.id, stored);
    this.references.set(withdrawal.reference, withdrawal.id);

    return stored;
  }

  getById(id: string): ExchangeWithdrawalRecord | null {
    const withdrawal = this.withdrawals.get(id);

    if (withdrawal === undefined) {
      return null;
    }

    return Object.freeze({ ...withdrawal });
  }

  private validate(withdrawal: ExchangeWithdrawalRecord): void {
    if (withdrawal.exchangeAssetAccountId.trim().length === 0) {
      throw new Error("Exchange withdrawal asset account ID must not be empty");
    }

    if (withdrawal.networkId.trim().length === 0) {
      throw new Error("Exchange withdrawal network ID must not be empty");
    }

    if (withdrawal.destination.trim().length === 0) {
      throw new Error("Exchange withdrawal destination must not be empty");
    }

    if (!/^[0-9]+$/.test(withdrawal.amount) || BigInt(withdrawal.amount) <= 0n) {
      throw new Error("Exchange withdrawal amount must be positive");
    }

    if (withdrawal.reference.trim().length === 0) {
      throw new Error("Exchange withdrawal reference must not be empty");
    }
  }
}
