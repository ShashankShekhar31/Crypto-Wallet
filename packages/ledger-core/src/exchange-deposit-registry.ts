import type { ExchangeDepositRecord } from "./exchange-deposit-types.js";

export class ExchangeDepositRegistry {
  private readonly deposits = new Map<string, ExchangeDepositRecord>();
  private readonly references = new Map<string, string>();

  create(deposit: ExchangeDepositRecord): ExchangeDepositRecord {
    if (this.deposits.has(deposit.id)) {
      throw new Error(
        `Exchange deposit already exists: ${deposit.id}`,
      );
    }

    if (this.references.has(deposit.reference)) {
      throw new Error(
        `Exchange deposit reference already exists: ${deposit.reference}`,
      );
    }

    this.validate(deposit);

    const stored = Object.freeze({ ...deposit });

    this.deposits.set(deposit.id, stored);
    this.references.set(deposit.reference, deposit.id);

    return stored;
  }

  getById(id: string): ExchangeDepositRecord | null {
    const deposit = this.deposits.get(id);

    if (deposit === undefined) {
      return null;
    }

    return Object.freeze({ ...deposit });
  }

  private validate(deposit: ExchangeDepositRecord): void {
    if (deposit.exchangeAssetAccountId.trim().length === 0) {
      throw new Error(
        "Exchange deposit asset account ID must not be empty",
      );
    }

    if (deposit.networkId.trim().length === 0) {
      throw new Error("Exchange deposit network ID must not be empty");
    }

    if (deposit.transactionHash.trim().length === 0) {
      throw new Error(
        "Exchange deposit transaction hash must not be empty",
      );
    }

    if (!/^[0-9]+$/.test(deposit.amount) || BigInt(deposit.amount) <= 0n) {
      throw new Error("Exchange deposit amount must be positive");
    }

    if (deposit.reference.trim().length === 0) {
      throw new Error("Exchange deposit reference must not be empty");
    }
  }
}