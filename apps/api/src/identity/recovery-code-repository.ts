import { randomUUID } from "node:crypto";

import type { Storage } from "@crypto-wallet/storage";

import { hashRecoveryCode } from "./recovery-code.js";

export interface RecoveryCodeRecord {
  id: string;
  identityAccountId: string;
  codeHash: string;
  usedAt: Date | null;
  createdAt: Date;
}

interface RecoveryCodeRow {
  id: string;
  identity_account_id: string;
  code_hash: string;
  used_at: Date | null;
  created_at: Date;
}

export class RecoveryCodeRepository {
  constructor(private readonly storage: Storage) {}

  async createCodes(
    identityAccountId: string,
    codes: string[],
  ): Promise<RecoveryCodeRecord[]> {
    if (!identityAccountId) {
      throw new Error(
        "Identity account ID is required",
      );
    }

    if (codes.length === 0) {
      throw new Error(
        "At least one recovery code is required",
      );
    }

    return this.storage.transaction(
      async (transaction) => {
        const records: RecoveryCodeRecord[] = [];

        for (const code of codes) {
          const id = randomUUID();
          const codeHash = hashRecoveryCode(code);

          const result =
            await transaction.query<RecoveryCodeRow>(
              `
                INSERT INTO recovery_codes (
                  id,
                  identity_account_id,
                  code_hash
                )
                VALUES (
                  $1,
                  $2,
                  $3
                )
                RETURNING
                  id,
                  identity_account_id,
                  code_hash,
                  used_at,
                  created_at
              `,
              [
                id,
                identityAccountId,
                codeHash,
              ],
            );

          const row = result.rows[0];

          if (!row) {
            throw new Error(
              "Failed to create recovery code",
            );
          }

          records.push(mapRecoveryCode(row));
        }

        return records;
      },
    );
  }

  async consumeCode(
    identityAccountId: string,
    code: string,
  ): Promise<RecoveryCodeRecord | null> {
    if (!identityAccountId) {
      throw new Error(
        "Identity account ID is required",
      );
    }

    const codeHash = hashRecoveryCode(code);

    const result =
      await this.storage.query<RecoveryCodeRow>(
        `
          UPDATE recovery_codes
          SET used_at = NOW()
          WHERE identity_account_id = $1
            AND code_hash = $2
            AND used_at IS NULL
          RETURNING
            id,
            identity_account_id,
            code_hash,
            used_at,
            created_at
        `,
        [
          identityAccountId,
          codeHash,
        ],
      );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapRecoveryCode(row);
  }

  async listUnusedCodes(
    identityAccountId: string,
  ): Promise<RecoveryCodeRecord[]> {
    const result =
      await this.storage.query<RecoveryCodeRow>(
        `
          SELECT
            id,
            identity_account_id,
            code_hash,
            used_at,
            created_at
          FROM recovery_codes
          WHERE identity_account_id = $1
            AND used_at IS NULL
          ORDER BY created_at ASC
        `,
        [identityAccountId],
      );

    return result.rows.map(mapRecoveryCode);
  }

  async revokeUnusedCodes(
    identityAccountId: string,
  ): Promise<number> {
    const result = await this.storage.query(
      `
        DELETE FROM recovery_codes
        WHERE identity_account_id = $1
          AND used_at IS NULL
      `,
      [identityAccountId],
    );

    return result.rowCount ?? 0;
  }
}

function mapRecoveryCode(
  row: RecoveryCodeRow,
): RecoveryCodeRecord {
  return {
    id: row.id,
    identityAccountId: row.identity_account_id,
    codeHash: row.code_hash,
    usedAt: row.used_at,
    createdAt: row.created_at,
  };
}