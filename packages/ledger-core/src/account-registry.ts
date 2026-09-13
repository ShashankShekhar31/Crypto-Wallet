import type { LedgerAccountRecord } from "./ledger-types.js";

export class LedgerAccountRegistry {
  private readonly accounts = new Map<string, LedgerAccountRecord>();
  private readonly identities = new Map<string, string>();

  create(account: LedgerAccountRecord): LedgerAccountRecord {
    if (this.accounts.has(account.id)) {
      throw new Error(`Ledger account already exists: ${account.id}`);
    }

    const identity = this.getIdentity(account);

    if (this.identities.has(identity)) {
      throw new Error(
        `Ledger account already exists for wallet, asset, chain and kind`,
      );
    }

    const stored = Object.freeze({ ...account });

    this.accounts.set(account.id, stored);
    this.identities.set(identity, account.id);

    return stored;
  }

  getById(id: string): LedgerAccountRecord | null {
    const account = this.accounts.get(id);

    if (account === undefined) {
      return null;
    }

    return Object.freeze({ ...account });
  }

  private getIdentity(account: LedgerAccountRecord): string {
    return JSON.stringify([
      account.walletId,
      account.assetId,
      account.chain,
      account.kind,
    ]);
  }
}