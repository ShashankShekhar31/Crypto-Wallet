import type { Transaction, TransactionStatus } from "@crypto-wallet/shared-types";

import { transitionTransaction } from "./transaction-lifecycle.js";

export function createTransactionState(transaction: Transaction): Transaction {
  return {
    ...transaction,
  };
}

export function updateTransactionStatus(
  transaction: Transaction,
  status: TransactionStatus,
): Transaction {
  return {
    ...transaction,
    status: transitionTransaction(transaction.status, status),
  };
}
