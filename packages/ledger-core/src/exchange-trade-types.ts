export type ExchangeTradeStatus = "executed" | "reversed";

export interface ExchangeTradeRecord {
  id: string;
  buyerExchangeAssetAccountId: string;
  sellerExchangeAssetAccountId: string;
  baseAssetId: string;
  quoteAssetId: string;
  baseAmount: string;
  quoteAmount: string;
  priceNumerator: string;
  priceDenominator: string;
  status: ExchangeTradeStatus;
  reference: string;
  executedAt: string;
}