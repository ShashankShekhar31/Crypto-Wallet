export type ExchangeWithdrawalStatus =
  "requested" | "approved" | "rejected" | "submitted" | "confirmed" | "failed";

export interface ExchangeWithdrawalRecord {
  id: string;
  exchangeAssetAccountId: string;
  networkId: string;
  destination: string;
  amount: string;
  status: ExchangeWithdrawalStatus;
  reference: string;
  createdAt: string;
}
