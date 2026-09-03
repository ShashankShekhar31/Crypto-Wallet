import type { TransactionStatus } from "@crypto-wallet/shared-types";

const TRANSACTION_TRANSITIONS: Readonly<Record<TransactionStatus, readonly TransactionStatus[]>> = {
  draft: ["signed"],
  signed: ["submitted"],
  submitted: ["pending"],
  pending: ["confirmed", "failed"],
  confirmed: [],
  failed: [],
};

export function canTransitionTransaction(from: TransactionStatus, to: TransactionStatus): boolean {
  return TRANSACTION_TRANSITIONS[from].includes(to);
}

export function transitionTransaction(
  from: TransactionStatus,
  to: TransactionStatus,
): TransactionStatus {
  if (!canTransitionTransaction(from, to)) {
    throw new Error(`Invalid transaction transition: ${from} -> ${to}`);
  }

  return to;
}
