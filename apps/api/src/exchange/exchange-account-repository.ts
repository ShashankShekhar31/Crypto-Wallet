import { randomUUID } from "node:crypto";

import type { Storage } from "@crypto-wallet/storage";

export type ExchangeAccountOwnerType = "customer" | "platform";

export type ExchangeAccountKind = "customer" | "treasury" | "fee" | "operational";

export type ExchangeAccountStatus = "active" | "blocked";

export interface ExchangeAccountRecord {
  id: string;
  ownerType: ExchangeAccountOwnerType;
  ownerId: string;
  kind: ExchangeAccountKind;
  status: ExchangeAccountStatus;
  createdAt: Date;
}

export interface CreateExchangeAccountInput {
  ownerType: ExchangeAccountOwnerType;
  ownerId: string;
  kind: ExchangeAccountKind;
  status?: ExchangeAccountStatus;
}

interface ExchangeAccountRow {
  id: string;
  owner_type: ExchangeAccountOwnerType;
  owner_id: string;
  kind: ExchangeAccountKind;
  status: ExchangeAccountStatus;
  created_at: Date;
}

export class ExchangeAccountRepository {
  constructor(private readonly storage: Storage) {}

  async create(input: CreateExchangeAccountInput): Promise<ExchangeAccountRecord> {
    const id = randomUUID();

    const result = await this.storage.query<ExchangeAccountRow>(
      `
        INSERT INTO exchange_accounts (
          id,
          owner_type,
          owner_id,
          kind,
          status
        )
        VALUES ($1, $2, $3, $4, COALESCE($5, 'active'))
        RETURNING
          id,
          owner_type,
          owner_id,
          kind,
          status,
          created_at
      `,
      [id, input.ownerType, input.ownerId, input.kind, input.status ?? null],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to create exchange account");
    }

    return mapExchangeAccount(row);
  }

  async findById(id: string): Promise<ExchangeAccountRecord | null> {
    const result = await this.storage.query<ExchangeAccountRow>(
      `
        SELECT
          id,
          owner_type,
          owner_id,
          kind,
          status,
          created_at
        FROM exchange_accounts
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapExchangeAccount(row);
  }

  async findByOwnerAndKind(
    ownerType: ExchangeAccountOwnerType,
    ownerId: string,
    kind: ExchangeAccountKind,
  ): Promise<ExchangeAccountRecord | null> {
    const result = await this.storage.query<ExchangeAccountRow>(
      `
        SELECT
          id,
          owner_type,
          owner_id,
          kind,
          status,
          created_at
        FROM exchange_accounts
        WHERE owner_type = $1
          AND owner_id = $2
          AND kind = $3
        LIMIT 1
      `,
      [ownerType, ownerId, kind],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapExchangeAccount(row);
  }
}

function mapExchangeAccount(row: ExchangeAccountRow): ExchangeAccountRecord {
  return {
    id: row.id,
    ownerType: row.owner_type,
    ownerId: row.owner_id,
    kind: row.kind,
    status: row.status,
    createdAt: row.created_at,
  };
}
