export type LedgerEntryType = "debit" | "credit";

export type LedgerEntryStatus = "pending" | "posted" | "reversed";

export interface LedgerAccount {
  id: string;
  walletId: string;
  assetId: string;
  chain: string;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  ledgerAccountId: string;
  transactionId: string;
  type: LedgerEntryType;
  amount: string;
  status: LedgerEntryStatus;
  createdAt: string;
}

export interface LedgerTransaction {
  id: string;
  reference: string;
  status: LedgerEntryStatus;
  createdAt: string;
}
