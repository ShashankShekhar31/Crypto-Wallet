import { randomUUID } from "node:crypto";

import type { Storage } from "@crypto-wallet/storage";

export type ExchangeWithdrawalStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "submitted"
  | "confirmed"
  | "failed";

export interface ExchangeWithdrawalRecord {
  id: string;
  requestedBy: string;
  approvedBy: string | null;
  exchangeAssetAccountId: string;
  networkId: string;
  destination: string;
  amount: string;
  status: ExchangeWithdrawalStatus;
  reference: string;
  createdAt: Date;
}

export interface CreateExchangeWithdrawalInput {
  requestedBy: string;
  approvedBy?: string;
  exchangeAssetAccountId: string;
  networkId: string;
  destination: string;
  amount: string;
  status?: ExchangeWithdrawalStatus;
  reference: string;
}

interface ExchangeWithdrawalRow {
  id: string;
  requested_by: string;
  approved_by: string | null;
  exchange_asset_account_id: string;
  network_id: string;
  destination: string;
  amount: string;
  status: ExchangeWithdrawalStatus;
  reference: string;
  created_at: Date;
}

export class ExchangeWithdrawalRepository {
  constructor(private readonly storage: Storage) {}

  async create(
    input: CreateExchangeWithdrawalInput,
  ): Promise<ExchangeWithdrawalRecord> {
    const id = randomUUID();

    const result = await this.storage.query<ExchangeWithdrawalRow>(
      `
        INSERT INTO exchange_withdrawals (
          id,
          requested_by,
          approved_by,
          exchange_asset_account_id,
          network_id,
          destination,
          amount,
          status,
          reference
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING
          id,
          requested_by,
          approved_by,
          exchange_asset_account_id,
          network_id,
          destination,
          amount,
          status,
          reference,
          created_at
      `,
      [
        id,
        input.requestedBy,
        input.approvedBy ?? null,
        input.exchangeAssetAccountId,
        input.networkId,
        input.destination,
        input.amount,
        input.status ?? "requested",
        input.reference,
      ],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to create exchange withdrawal");
    }

    return mapExchangeWithdrawal(row);
  }

  async findById(
    id: string,
  ): Promise<ExchangeWithdrawalRecord | null> {
    const result = await this.storage.query<ExchangeWithdrawalRow>(
      `
        SELECT
          id,
          requested_by,
          approved_by,
          exchange_asset_account_id,
          network_id,
          destination,
          amount,
          status,
          reference,
          created_at
        FROM exchange_withdrawals
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapExchangeWithdrawal(row);
  }

  async findByReference(
    reference: string,
  ): Promise<ExchangeWithdrawalRecord | null> {
    const result = await this.storage.query<ExchangeWithdrawalRow>(
      `
        SELECT
          id,
          requested_by,
          approved_by,
          exchange_asset_account_id,
          network_id,
          destination,
          amount,
          status,
          reference,
          created_at
        FROM exchange_withdrawals
        WHERE reference = $1
        LIMIT 1
      `,
      [reference],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapExchangeWithdrawal(row);
  }
}

function mapExchangeWithdrawal(
  row: ExchangeWithdrawalRow,
): ExchangeWithdrawalRecord {
  return {
    id: row.id,
    requestedBy: row.requested_by,
    approvedBy: row.approved_by,
    exchangeAssetAccountId: row.exchange_asset_account_id,
    networkId: row.network_id,
    destination: row.destination,
    amount: row.amount,
    status: row.status,
    reference: row.reference,
    createdAt: row.created_at,
  };
}