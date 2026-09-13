import { randomUUID } from "node:crypto";

import type { Storage } from "@crypto-wallet/storage";

export interface ExchangeAssetAccountRecord {
  id: string;
  exchangeAccountId: string;
  assetId: string;
  networkId: string;
  createdAt: Date;
}

export interface CreateExchangeAssetAccountInput {
  exchangeAccountId: string;
  assetId: string;
  networkId: string;
}

interface ExchangeAssetAccountRow {
  id: string;
  exchange_account_id: string;
  asset_id: string;
  network_id: string;
  created_at: Date;
}

export class ExchangeAssetAccountRepository {
  constructor(private readonly storage: Storage) {}

  async create(input: CreateExchangeAssetAccountInput): Promise<ExchangeAssetAccountRecord> {
    const id = randomUUID();

    const result = await this.storage.query<ExchangeAssetAccountRow>(
      `
        INSERT INTO exchange_asset_accounts (
          id,
          exchange_account_id,
          asset_id,
          network_id
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          exchange_account_id,
          asset_id,
          network_id,
          created_at
      `,
      [id, input.exchangeAccountId, input.assetId, input.networkId],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to create exchange asset account");
    }

    return mapExchangeAssetAccount(row);
  }

  async findById(id: string): Promise<ExchangeAssetAccountRecord | null> {
    const result = await this.storage.query<ExchangeAssetAccountRow>(
      `
        SELECT
          id,
          exchange_account_id,
          asset_id,
          network_id,
          created_at
        FROM exchange_asset_accounts
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapExchangeAssetAccount(row);
  }

  async findByAccountAndAsset(
    exchangeAccountId: string,
    assetId: string,
  ): Promise<ExchangeAssetAccountRecord | null> {
    const result = await this.storage.query<ExchangeAssetAccountRow>(
      `
        SELECT
          id,
          exchange_account_id,
          asset_id,
          network_id,
          created_at
        FROM exchange_asset_accounts
        WHERE exchange_account_id = $1
          AND asset_id = $2
        LIMIT 1
      `,
      [exchangeAccountId, assetId],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapExchangeAssetAccount(row);
  }

  async listByExchangeAccount(exchangeAccountId: string): Promise<ExchangeAssetAccountRecord[]> {
    const result = await this.storage.query<ExchangeAssetAccountRow>(
      `
        SELECT
          id,
          exchange_account_id,
          asset_id,
          network_id,
          created_at
        FROM exchange_asset_accounts
        WHERE exchange_account_id = $1
        ORDER BY created_at ASC, id ASC
      `,
      [exchangeAccountId],
    );

    return result.rows.map(mapExchangeAssetAccount);
  }
}

function mapExchangeAssetAccount(row: ExchangeAssetAccountRow): ExchangeAssetAccountRecord {
  return {
    id: row.id,
    exchangeAccountId: row.exchange_account_id,
    assetId: row.asset_id,
    networkId: row.network_id,
    createdAt: row.created_at,
  };
}
