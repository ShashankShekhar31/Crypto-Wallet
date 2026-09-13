import type { LedgerSubaccountRecord } from "./ledger-types.js";

export class LedgerSubaccountRegistry {
  private readonly subaccounts = new Map<string, LedgerSubaccountRecord>();
  private readonly identities = new Map<string, string>();

  create(subaccount: LedgerSubaccountRecord): LedgerSubaccountRecord {
    if (this.subaccounts.has(subaccount.id)) {
      throw new Error(`Ledger subaccount already exists: ${subaccount.id}`);
    }

    const identity = this.getIdentity(subaccount);

    if (this.identities.has(identity)) {
      throw new Error(`Ledger subaccount already exists for ledger account and name`);
    }

    const stored = Object.freeze({ ...subaccount });

    this.subaccounts.set(subaccount.id, stored);
    this.identities.set(identity, subaccount.id);

    return stored;
  }

  getById(id: string): LedgerSubaccountRecord | null {
    const subaccount = this.subaccounts.get(id);

    if (subaccount === undefined) {
      return null;
    }

    return Object.freeze({ ...subaccount });
  }

  private getIdentity(subaccount: LedgerSubaccountRecord): string {
    return JSON.stringify([subaccount.ledgerAccountId, subaccount.name]);
  }
}
