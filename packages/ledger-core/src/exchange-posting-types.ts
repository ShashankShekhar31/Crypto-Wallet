export type ExchangePostingOperation = "deposit" | "withdrawal" | "trade" | "fee";

export interface ExchangePosting {
  ledgerAccountId: string;
  type: "debit" | "credit";
  amount: string;
}

export interface ExchangeLedgerTransaction {
  id: string;
  reference: string;
  operation: ExchangePostingOperation;
  postings: readonly ExchangePosting[];
}
