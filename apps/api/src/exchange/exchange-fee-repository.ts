import { randomUUID } from "node:crypto";

import type { Storage } from "@crypto-wallet/storage";

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
  createdAt: Date;
}

export interface CreateExchangeFeeInput {
  tradeId: string;
  sourceExchangeAssetAccountId: string;
  feeExchangeAssetAccountId: string;
  assetId: string;
  amount: string;
  status?: ExchangeFeeStatus;
  reference: string;
}

interface ExchangeFeeRow {
  id: string;
  trade_id: string;
  source_exchange_asset_account_id: string;
  fee_exchange_asset_account_id: string;
  asset_id: string;
  amount: string;
  status: ExchangeFeeStatus;
  reference: string;
  created_at: Date;
}

export class ExchangeFeeRepository {
  constructor(private readonly storage: Storage) {}

  async create(
    input: CreateExchangeFeeInput,
  ): Promise<ExchangeFeeRecord> {
    const id = randomUUID();

    const result = await this.storage.query<ExchangeFeeRow>(
      `
        INSERT INTO exchange_fees (
          id,
          trade_id,
          source_exchange_asset_account_id,
          fee_exchange_asset_account_id,
          asset_id,
          amount,
          status,
          reference
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING
          id,
          trade_id,
          source_exchange_asset_account_id,
          fee_exchange_asset_account_id,
          asset_id,
          amount,
          status,
          reference,
          created_at
      `,
      [
        id,
        input.tradeId,
        input.sourceExchangeAssetAccountId,
        input.feeExchangeAssetAccountId,
        input.assetId,
        input.amount,
        input.status ?? "charged",
        input.reference,
      ],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to create exchange fee");
    }

    return mapExchangeFee(row);
  }

  async findById(
    id: string,
  ): Promise<ExchangeFeeRecord | null> {
    const result = await this.storage.query<ExchangeFeeRow>(
      `
        SELECT
          id,
          trade_id,
          source_exchange_asset_account_id,
          fee_exchange_asset_account_id,
          asset_id,
          amount,
          status,
          reference,
          created_at
        FROM exchange_fees
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapExchangeFee(row);
  }

  async findByReference(
    reference: string,
  ): Promise<ExchangeFeeRecord | null> {
    const result = await this.storage.query<ExchangeFeeRow>(
      `
        SELECT
          id,
          trade_id,
          source_exchange_asset_account_id,
          fee_exchange_asset_account_id,
          asset_id,
          amount,
          status,
          reference,
          created_at
        FROM exchange_fees
        WHERE reference = $1
        LIMIT 1
      `,
      [reference],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapExchangeFee(row);
  }
}

function mapExchangeFee(
  row: ExchangeFeeRow,
): ExchangeFeeRecord {
  return {
    id: row.id,
    tradeId: row.trade_id,
    sourceExchangeAssetAccountId:
      row.source_exchange_asset_account_id,
    feeExchangeAssetAccountId:
      row.fee_exchange_asset_account_id,
    assetId: row.asset_id,
    amount: row.amount,
    status: row.status,
    reference: row.reference,
    createdAt: row.created_at,
  };
}