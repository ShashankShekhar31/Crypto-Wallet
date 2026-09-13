export type ExchangeDepositStatus = "detected" | "confirmed" | "credited" | "reversed";

export interface ExchangeDepositRecord {
  id: string;
  exchangeAssetAccountId: string;
  networkId: string;
  transactionHash: string;
  amount: string;
  status: ExchangeDepositStatus;
  reference: string;
  createdAt: string;
}
