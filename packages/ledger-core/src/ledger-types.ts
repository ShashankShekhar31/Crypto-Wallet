import type { LedgerEntryStatus, LedgerEntryType } from "@crypto-wallet/shared-types";

export interface LedgerAccountRecord {
  id: string;
  walletId: string;
  assetId: string;
  chain: string;
  kind: LedgerAccountKind;
  createdAt: string;
}

export type LedgerAccountKind = "asset" | "liability" | "revenue" | "expense" | "equity";

export interface LedgerSubaccountRecord {
  id: string;
  ledgerAccountId: string;
  name: string;
  createdAt: string;
}

export interface LedgerTransactionRecord {
  id: string;
  reference: string;
  status: LedgerEntryStatus;
  createdAt: string;
}

export interface LedgerEntryRecord {
  id: string;
  ledgerAccountId: string;
  transactionId: string;
  type: LedgerEntryType;
  amount: string;
  status: LedgerEntryStatus;
  createdAt: string;
}

export interface LedgerPosting {
  ledgerAccountId: string;
  type: LedgerEntryType;
  amount: string;
}

export interface CreateLedgerTransactionInput {
  id: string;
  reference: string;
  postings: readonly LedgerPosting[];
}

export interface LedgerBalance {
  ledgerAccountId: string;
  debit: string;
  credit: string;
  balance: string;
}
