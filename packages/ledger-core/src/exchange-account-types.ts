export type ExchangeAccountOwnerType = "customer" | "platform";

export type ExchangeAccountKind =
  | "customer"
  | "treasury"
  | "fee"
  | "operational";

export type ExchangeAccountStatus = "active" | "blocked";

export interface ExchangeAccountRecord {
  id: string;
  ownerType: ExchangeAccountOwnerType;
  ownerId: string;
  kind: ExchangeAccountKind;
  status: ExchangeAccountStatus;
  createdAt: string;
}

export interface ExchangeSubaccountRecord {
  id: string;
  exchangeAccountId: string;
  name: string;
  createdAt: string;
}

export interface ExchangeAssetAccountRecord {
  id: string;
  exchangeAccountId: string;
  assetId: string;
  networkId: string;
  createdAt: string;
}