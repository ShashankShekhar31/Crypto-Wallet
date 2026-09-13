import { randomUUID } from "node:crypto";

import type { Storage } from "@crypto-wallet/storage";

export type ExchangeTradeStatus = "executed" | "reversed";

export interface ExchangeTradeRecord {
  id: string;
  buyerBaseExchangeAssetAccountId: string;
  buyerQuoteExchangeAssetAccountId: string;
  sellerBaseExchangeAssetAccountId: string;
  sellerQuoteExchangeAssetAccountId: string;
  baseAssetId: string;
  quoteAssetId: string;
  baseAmount: string;
  quoteAmount: string;
  priceNumerator: string;
  priceDenominator: string;
  status: ExchangeTradeStatus;
  reference: string;
  executedAt: Date;
}

export interface CreateExchangeTradeInput {
  buyerBaseExchangeAssetAccountId: string;
  buyerQuoteExchangeAssetAccountId: string;
  sellerBaseExchangeAssetAccountId: string;
  sellerQuoteExchangeAssetAccountId: string;
  baseAssetId: string;
  quoteAssetId: string;
  baseAmount: string;
  quoteAmount: string;
  priceNumerator: string;
  priceDenominator: string;
  status?: ExchangeTradeStatus;
  reference: string;
  executedAt?: Date;
}

interface ExchangeTradeRow {
  id: string;
  buyer_base_exchange_asset_account_id: string;
  buyer_quote_exchange_asset_account_id: string;
  seller_base_exchange_asset_account_id: string;
  seller_quote_exchange_asset_account_id: string;
  base_asset_id: string;
  quote_asset_id: string;
  base_amount: string;
  quote_amount: string;
  price_numerator: string;
  price_denominator: string;
  status: ExchangeTradeStatus;
  reference: string;
  executed_at: Date;
}

export class ExchangeTradeRepository {
  constructor(private readonly storage: Storage) {}

  async create(input: CreateExchangeTradeInput): Promise<ExchangeTradeRecord> {
    const id = randomUUID();

    const result = await this.storage.query<ExchangeTradeRow>(
      `
        INSERT INTO exchange_trades (
          id,
          buyer_base_exchange_asset_account_id,
          buyer_quote_exchange_asset_account_id,
          seller_base_exchange_asset_account_id,
          seller_quote_exchange_asset_account_id,
          base_asset_id,
          quote_asset_id,
          base_amount,
          quote_amount,
          price_numerator,
          price_denominator,
          status,
          reference,
          executed_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14
        )
        RETURNING
          id,
          buyer_base_exchange_asset_account_id,
          buyer_quote_exchange_asset_account_id,
          seller_base_exchange_asset_account_id,
          seller_quote_exchange_asset_account_id,
          base_asset_id,
          quote_asset_id,
          base_amount,
          quote_amount,
          price_numerator,
          price_denominator,
          status,
          reference,
          executed_at
      `,
      [
        id,
        input.buyerBaseExchangeAssetAccountId,
        input.buyerQuoteExchangeAssetAccountId,
        input.sellerBaseExchangeAssetAccountId,
        input.sellerQuoteExchangeAssetAccountId,
        input.baseAssetId,
        input.quoteAssetId,
        input.baseAmount,
        input.quoteAmount,
        input.priceNumerator,
        input.priceDenominator,
        input.status ?? "executed",
        input.reference,
        input.executedAt ?? new Date(),
      ],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to create exchange trade");
    }

    return mapExchangeTrade(row);
  }

  async findById(id: string): Promise<ExchangeTradeRecord | null> {
    const result = await this.storage.query<ExchangeTradeRow>(
      `
        SELECT
          id,
          buyer_base_exchange_asset_account_id,
          buyer_quote_exchange_asset_account_id,
          seller_base_exchange_asset_account_id,
          seller_quote_exchange_asset_account_id,
          base_asset_id,
          quote_asset_id,
          base_amount,
          quote_amount,
          price_numerator,
          price_denominator,
          status,
          reference,
          executed_at
        FROM exchange_trades
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapExchangeTrade(row);
  }

  async findByReference(reference: string): Promise<ExchangeTradeRecord | null> {
    const result = await this.storage.query<ExchangeTradeRow>(
      `
        SELECT
          id,
          buyer_base_exchange_asset_account_id,
          buyer_quote_exchange_asset_account_id,
          seller_base_exchange_asset_account_id,
          seller_quote_exchange_asset_account_id,
          base_asset_id,
          quote_asset_id,
          base_amount,
          quote_amount,
          price_numerator,
          price_denominator,
          status,
          reference,
          executed_at
        FROM exchange_trades
        WHERE reference = $1
        LIMIT 1
      `,
      [reference],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapExchangeTrade(row);
  }
}

function mapExchangeTrade(row: ExchangeTradeRow): ExchangeTradeRecord {
  return {
    id: row.id,
    buyerBaseExchangeAssetAccountId: row.buyer_base_exchange_asset_account_id,
    buyerQuoteExchangeAssetAccountId: row.buyer_quote_exchange_asset_account_id,
    sellerBaseExchangeAssetAccountId: row.seller_base_exchange_asset_account_id,
    sellerQuoteExchangeAssetAccountId: row.seller_quote_exchange_asset_account_id,
    baseAssetId: row.base_asset_id,
    quoteAssetId: row.quote_asset_id,
    baseAmount: row.base_amount,
    quoteAmount: row.quote_amount,
    priceNumerator: row.price_numerator,
    priceDenominator: row.price_denominator,
    status: row.status,
    reference: row.reference,
    executedAt: row.executed_at,
  };
}
