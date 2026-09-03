import type { Transaction, TransactionStatus } from "@crypto-wallet/shared-types";

import { updateTransactionStatus } from "./transaction-state.js";

interface IdempotencyRecord {
  readonly fingerprint: string;
  readonly transactionId: string;
}

export interface TransactionEngine {
  create(transaction: Transaction): Transaction;

  createIdempotent(idempotencyKey: string, transaction: Transaction): Transaction;

  getById(id: string): Transaction | null;

  transition(id: string, status: TransactionStatus): Transaction;
}

export class DefaultTransactionEngine implements TransactionEngine {
  private readonly transactions = new Map<string, Transaction>();

  private readonly idempotencyRecords = new Map<string, IdempotencyRecord>();

  create(transaction: Transaction): Transaction {
    if (this.transactions.has(transaction.id)) {
      throw new Error(`Transaction already exists: ${transaction.id}`);
    }

    const stored = {
      ...transaction,
    };

    this.transactions.set(transaction.id, stored);

    return {
      ...stored,
    };
  }

  createIdempotent(idempotencyKey: string, transaction: Transaction): Transaction {
    const fingerprint = this.getTransactionFingerprint(transaction);
    const existing = this.idempotencyRecords.get(idempotencyKey);

    if (existing !== undefined) {
      if (existing.fingerprint !== fingerprint) {
        throw new Error(`Idempotency key already used: ${idempotencyKey}`);
      }

      const existingTransaction = this.transactions.get(existing.transactionId);

      if (existingTransaction === undefined) {
        throw new Error(`Transaction not found for idempotency key: ${idempotencyKey}`);
      }

      return {
        ...existingTransaction,
      };
    }

    const created = this.create(transaction);

    this.idempotencyRecords.set(idempotencyKey, {
      fingerprint,
      transactionId: created.id,
    });

    return {
      ...created,
    };
  }

  getById(id: string): Transaction | null {
    const transaction = this.transactions.get(id);

    if (transaction === undefined) {
      return null;
    }

    return {
      ...transaction,
    };
  }

  transition(id: string, status: TransactionStatus): Transaction {
    const transaction = this.transactions.get(id);

    if (transaction === undefined) {
      throw new Error(`Transaction not found: ${id}`);
    }

    const updated = updateTransactionStatus(transaction, status);

    this.transactions.set(id, updated);

    return {
      ...updated,
    };
  }

  private getTransactionFingerprint(transaction: Transaction): string {
    return JSON.stringify({
      chain: transaction.chain,
      status: transaction.status,
      assetId: transaction.assetId,
      amount: transaction.amount,
    });
  }
}
