import type { ExchangeAccountRecord } from "./exchange-account-types.js";

export class ExchangeAccountRegistry {
  private readonly accounts = new Map<string, ExchangeAccountRecord>();
  private readonly identities = new Map<string, string>();

  create(account: ExchangeAccountRecord): ExchangeAccountRecord {
    if (this.accounts.has(account.id)) {
      throw new Error(`Exchange account already exists: ${account.id}`);
    }

    const identity = this.getIdentity(account);

    if (this.identities.has(identity)) {
      throw new Error(
        "Exchange account already exists for owner and account kind",
      );
    }

    this.validate(account);

    const stored = Object.freeze({ ...account });

    this.accounts.set(account.id, stored);
    this.identities.set(identity, account.id);

    return stored;
  }

  getById(id: string): ExchangeAccountRecord | null {
    const account = this.accounts.get(id);

    if (account === undefined) {
      return null;
    }

    return Object.freeze({ ...account });
  }

  private getIdentity(account: ExchangeAccountRecord): string {
    return JSON.stringify([
      account.ownerType,
      account.ownerId,
      account.kind,
    ]);
  }

  private validate(account: ExchangeAccountRecord): void {
    if (account.ownerId.trim().length === 0) {
      throw new Error("Exchange account owner ID must not be empty");
    }

    if (
      account.ownerType === "customer" &&
      account.kind !== "customer"
    ) {
      throw new Error(
        "Customer-owned exchange accounts must have customer kind",
      );
    }

    if (
      account.ownerType === "platform" &&
      account.kind === "customer"
    ) {
      throw new Error(
        "Platform-owned exchange accounts cannot have customer kind",
      );
    }
  }
}