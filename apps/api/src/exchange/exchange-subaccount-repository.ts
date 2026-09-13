import { randomUUID } from "node:crypto";

import type { Storage } from "@crypto-wallet/storage";

export interface ExchangeSubaccountRecord {
  id: string;
  exchangeAccountId: string;
  name: string;
  createdAt: Date;
}

export interface CreateExchangeSubaccountInput {
  exchangeAccountId: string;
  name: string;
}

interface ExchangeSubaccountRow {
  id: string;
  exchange_account_id: string;
  name: string;
  created_at: Date;
}

export class ExchangeSubaccountRepository {
  constructor(private readonly storage: Storage) {}

  async create(input: CreateExchangeSubaccountInput): Promise<ExchangeSubaccountRecord> {
    const id = randomUUID();

    const result = await this.storage.query<ExchangeSubaccountRow>(
      `
        INSERT INTO exchange_subaccounts (
          id,
          exchange_account_id,
          name
        )
        VALUES ($1, $2, $3)
        RETURNING
          id,
          exchange_account_id,
          name,
          created_at
      `,
      [id, input.exchangeAccountId, input.name],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to create exchange subaccount");
    }

    return mapExchangeSubaccount(row);
  }

  async findById(id: string): Promise<ExchangeSubaccountRecord | null> {
    const result = await this.storage.query<ExchangeSubaccountRow>(
      `
        SELECT
          id,
          exchange_account_id,
          name,
          created_at
        FROM exchange_subaccounts
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapExchangeSubaccount(row);
  }

  async listByExchangeAccount(exchangeAccountId: string): Promise<ExchangeSubaccountRecord[]> {
    const result = await this.storage.query<ExchangeSubaccountRow>(
      `
        SELECT
          id,
          exchange_account_id,
          name,
          created_at
        FROM exchange_subaccounts
        WHERE exchange_account_id = $1
        ORDER BY created_at ASC, id ASC
      `,
      [exchangeAccountId],
    );

    return result.rows.map(mapExchangeSubaccount);
  }
}

function mapExchangeSubaccount(row: ExchangeSubaccountRow): ExchangeSubaccountRecord {
  return {
    id: row.id,
    exchangeAccountId: row.exchange_account_id,
    name: row.name,
    createdAt: row.created_at,
  };
}
