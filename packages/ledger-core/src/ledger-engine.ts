import type { CreateLedgerTransactionInput, LedgerBalance, LedgerPosting } from "./ledger-types.js";

function freezeTransaction(
  transaction: CreateLedgerTransactionInput,
): CreateLedgerTransactionInput {
  const postings = transaction.postings.map((posting: LedgerPosting) =>
    Object.freeze({ ...posting }),
  );

  return Object.freeze({
    ...transaction,
    postings: Object.freeze(postings),
  });
}

export class DefaultLedgerEngine {
  private readonly transactions = new Map<string, CreateLedgerTransactionInput>();

  private readonly references = new Map<string, string>();

  createTransaction(transaction: CreateLedgerTransactionInput): CreateLedgerTransactionInput {
    if (this.transactions.has(transaction.id)) {
      throw new Error(`Ledger transaction already exists: ${transaction.id}`);
    }

    if (this.references.has(transaction.reference)) {
      throw new Error(`Ledger transaction reference already exists: ${transaction.reference}`);
    }

    if (transaction.postings.length < 2) {
      throw new Error("Ledger transaction requires at least two postings");
    }

    let debits = 0n;
    let credits = 0n;

    for (const posting of transaction.postings) {
      if (!/^[0-9]+$/.test(posting.amount) || BigInt(posting.amount) <= 0n) {
        throw new Error("Ledger posting amount must be positive");
      }

      const amount = BigInt(posting.amount);

      if (posting.type === "debit") {
        debits += amount;
      } else if (posting.type === "credit") {
        credits += amount;
      }
    }

    if (debits !== credits) {
      throw new Error("Ledger transaction must balance");
    }

    const stored = freezeTransaction(transaction);

    this.transactions.set(transaction.id, stored);
    this.references.set(transaction.reference, transaction.id);

    return stored;
  }

  getById(id: string): CreateLedgerTransactionInput | null {
    const transaction = this.transactions.get(id);

    if (transaction === undefined) {
      return null;
    }

    return freezeTransaction(transaction);
  }
  getBalance(ledgerAccountId: string): LedgerBalance {
    let debit = 0n;
    let credit = 0n;

    for (const transaction of this.transactions.values()) {
      for (const posting of transaction.postings) {
        if (posting.ledgerAccountId !== ledgerAccountId) {
          continue;
        }

        const amount = BigInt(posting.amount);

        if (posting.type === "debit") {
          debit += amount;
        } else if (posting.type === "credit") {
          credit += amount;
        }
      }
    }

    return {
      ledgerAccountId,
      debit: debit.toString(),
      credit: credit.toString(),
      balance: (debit - credit).toString(),
    };
  }
}
