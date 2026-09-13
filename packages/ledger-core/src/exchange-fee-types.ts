export type ExchangeFeeStatus = "charged" | "reversed";

export interface ExchangeFeeRecord {
  id: string;
  tradeId: string;
  sourceExchangeAssetAccountId: string;
  feeExchangeAssetAccountId: string;
  assetId: string;
  amount: string;
  status: ExchangeFeeStatus;
  reference: string;
  createdAt: string;
}