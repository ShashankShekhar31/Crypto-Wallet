export type SupportedChain = "evm" | "solana" | "bitcoin";

export type WalletType = "self-custody";

export type TransactionStatus =
  "draft" | "signed" | "submitted" | "pending" | "confirmed" | "failed";

export interface WalletAccount {
  id: string;
  name: string;
  type: WalletType;
  createdAt: string;
}

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  chain: SupportedChain;
  decimals: number;
}

export interface Balance {
  assetId: string;
  amount: string;
  formattedAmount: string;
}

export interface Transaction {
  id: string;
  chain: SupportedChain;
  status: TransactionStatus;
  assetId: string;
  amount: string;
  createdAt: string;
}

export * from "./ledger.js";
