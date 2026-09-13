import { randomUUID } from "node:crypto";

import type { Storage } from "@crypto-wallet/storage";

export type ExchangeDepositStatus = "detected" | "confirmed" | "credited" | "reversed";

export interface ExchangeDepositRecord {
  id: string;
  exchangeAssetAccountId: string;
  networkId: string;
  transactionHash: string;
  amount: string;
  status: ExchangeDepositStatus;
  reference: string;
  createdAt: Date;
}

export interface CreateExchangeDepositInput {
  exchangeAssetAccountId: string;
  networkId: string;
  transactionHash: string;
  amount: string;
  status?: ExchangeDepositStatus;
  reference: string;
}

interface ExchangeDepositRow {
  id: string;
  exchange_asset_account_id: string;
  network_id: string;
  transaction_hash: string;
  amount: string;
  status: ExchangeDepositStatus;
  reference: string;
  created_at: Date;
}

export class ExchangeDepositRepository {
  constructor(private readonly storage: Storage) {}

  async create(input: CreateExchangeDepositInput): Promise<ExchangeDepositRecord> {
    const id = randomUUID();

    const result = await this.storage.query<ExchangeDepositRow>(
      `
        INSERT INTO exchange_deposits (
          id,
          exchange_asset_account_id,
          network_id,
          transaction_hash,
          amount,
          status,
          reference
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id,
          exchange_asset_account_id,
          network_id,
          transaction_hash,
          amount,
          status,
          reference,
          created_at
      `,
      [
        id,
        input.exchangeAssetAccountId,
        input.networkId,
        input.transactionHash,
        input.amount,
        input.status ?? "detected",
        input.reference,
      ],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to create exchange deposit");
    }

    return mapExchangeDeposit(row);
  }

  async findById(id: string): Promise<ExchangeDepositRecord | null> {
    const result = await this.storage.query<ExchangeDepositRow>(
      `
        SELECT
          id,
          exchange_asset_account_id,
          network_id,
          transaction_hash,
          amount,
          status,
          reference,
          created_at
        FROM exchange_deposits
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapExchangeDeposit(row);
  }

  async findByReference(reference: string): Promise<ExchangeDepositRecord | null> {
    const result = await this.storage.query<ExchangeDepositRow>(
      `
        SELECT
          id,
          exchange_asset_account_id,
          network_id,
          transaction_hash,
          amount,
          status,
          reference,
          created_at
        FROM exchange_deposits
        WHERE reference = $1
        LIMIT 1
      `,
      [reference],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapExchangeDeposit(row);
  }

  async findByTransaction(
    networkId: string,
    transactionHash: string,
  ): Promise<ExchangeDepositRecord | null> {
    const result = await this.storage.query<ExchangeDepositRow>(
      `
        SELECT
          id,
          exchange_asset_account_id,
          network_id,
          transaction_hash,
          amount,
          status,
          reference,
          created_at
        FROM exchange_deposits
        WHERE network_id = $1
          AND transaction_hash = $2
        LIMIT 1
      `,
      [networkId, transactionHash],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapExchangeDeposit(row);
  }
}

function mapExchangeDeposit(row: ExchangeDepositRow): ExchangeDepositRecord {
  return {
    id: row.id,
    exchangeAssetAccountId: row.exchange_asset_account_id,
    networkId: row.network_id,
    transactionHash: row.transaction_hash,
    amount: row.amount,
    status: row.status,
    reference: row.reference,
    createdAt: row.created_at,
  };
}
