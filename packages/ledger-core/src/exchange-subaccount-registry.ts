import type { ExchangeSubaccountRecord } from "./exchange-account-types.js";

export class ExchangeSubaccountRegistry {
  private readonly subaccounts = new Map<string, ExchangeSubaccountRecord>();

  private readonly identities = new Map<string, string>();

  create(subaccount: ExchangeSubaccountRecord): ExchangeSubaccountRecord {
    if (this.subaccounts.has(subaccount.id)) {
      throw new Error(`Exchange subaccount already exists: ${subaccount.id}`);
    }

    const identity = this.getIdentity(subaccount);

    if (this.identities.has(identity)) {
      throw new Error("Exchange subaccount already exists for exchange account and name");
    }

    this.validate(subaccount);

    const stored = Object.freeze({ ...subaccount });

    this.subaccounts.set(subaccount.id, stored);
    this.identities.set(identity, subaccount.id);

    return stored;
  }

  getById(id: string): ExchangeSubaccountRecord | null {
    const subaccount = this.subaccounts.get(id);

    if (subaccount === undefined) {
      return null;
    }

    return Object.freeze({ ...subaccount });
  }

  private getIdentity(subaccount: ExchangeSubaccountRecord): string {
    return JSON.stringify([subaccount.exchangeAccountId, subaccount.name]);
  }

  private validate(subaccount: ExchangeSubaccountRecord): void {
    if (subaccount.exchangeAccountId.trim().length === 0) {
      throw new Error("Exchange subaccount exchange account ID must not be empty");
    }

    if (subaccount.name.trim().length === 0) {
      throw new Error("Exchange subaccount name must not be empty");
    }
  }
}
