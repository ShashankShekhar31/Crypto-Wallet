import { randomUUID } from "node:crypto";

import type { Storage } from "@crypto-wallet/storage";

export interface IdentityAccountRecord {
  id: string;
  userId: string;
  normalizedEmail: string;
  status: "active" | "locked" | "recovery_required" | "disabled";
  createdAt: Date;
  updatedAt: Date;
}

export interface PasswordCredentialRecord {
  id: string;
  identityAccountId: string;
  passwordHash: string;
  passwordChangedAt: Date;
  failedAttemptCount: number;
  lockedUntil: Date | null;
}

interface IdentityAccountRow {
  id: string;
  user_id: string;
  normalized_email: string;
  status: IdentityAccountRecord["status"];
  created_at: Date;
  updated_at: Date;
}

interface PasswordCredentialRow {
  id: string;
  identity_account_id: string;
  password_hash: string;
  password_changed_at: Date;
  failed_attempt_count: number;
  locked_until: Date | null;
}

export interface CreateIdentityAccountInput {
  userId: string;
  normalizedEmail: string;
  passwordHash: string;
}

export interface CreatedIdentityAccount {
  identityAccount: IdentityAccountRecord;
  passwordCredential: PasswordCredentialRecord;
}

export class IdentityRepository {
  constructor(private readonly storage: Storage) {}

  async findByEmail(
    normalizedEmail: string,
  ): Promise<IdentityAccountRecord | null> {
    const result = await this.storage.query<IdentityAccountRow>(
      `
        SELECT
          id,
          user_id,
          normalized_email,
          status,
          created_at,
          updated_at
        FROM identity_accounts
        WHERE normalized_email = $1
        LIMIT 1
      `,
      [normalizedEmail],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapIdentityAccount(row);
  }

  async findPasswordCredential(
    identityAccountId: string,
  ): Promise<PasswordCredentialRecord | null> {
    const result = await this.storage.query<PasswordCredentialRow>(
      `
        SELECT
          id,
          identity_account_id,
          password_hash,
          password_changed_at,
          failed_attempt_count,
          locked_until
        FROM password_credentials
        WHERE identity_account_id = $1
        LIMIT 1
      `,
      [identityAccountId],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapPasswordCredential(row);
  }

  async createIdentityAccount(
    input: CreateIdentityAccountInput,
  ): Promise<CreatedIdentityAccount> {
    const identityAccountId = randomUUID();
    const passwordCredentialId = randomUUID();

    return this.storage.transaction(async (transaction) => {
      const identityResult =
        await transaction.query<IdentityAccountRow>(
          `
            INSERT INTO identity_accounts (
              id,
              user_id,
              normalized_email,
              status
            )
            VALUES ($1, $2, $3, 'active')
            RETURNING
              id,
              user_id,
              normalized_email,
              status,
              created_at,
              updated_at
          `,
          [
            identityAccountId,
            input.userId,
            input.normalizedEmail,
          ],
        );

      const identityRow = identityResult.rows[0];

      if (!identityRow) {
        throw new Error(
          "Failed to create identity account",
        );
      }

      const credentialResult =
        await transaction.query<PasswordCredentialRow>(
          `
            INSERT INTO password_credentials (
              id,
              identity_account_id,
              password_hash
            )
            VALUES ($1, $2, $3)
            RETURNING
              id,
              identity_account_id,
              password_hash,
              password_changed_at,
              failed_attempt_count,
              locked_until
          `,
          [
            passwordCredentialId,
            identityAccountId,
            input.passwordHash,
          ],
        );

      const credentialRow = credentialResult.rows[0];

      if (!credentialRow) {
        throw new Error(
          "Failed to create password credential",
        );
      }

      return {
        identityAccount: mapIdentityAccount(identityRow),
        passwordCredential: mapPasswordCredential(credentialRow),
      };
    });
  }
}

function mapIdentityAccount(
  row: IdentityAccountRow,
): IdentityAccountRecord {
  return {
    id: row.id,
    userId: row.user_id,
    normalizedEmail: row.normalized_email,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPasswordCredential(
  row: PasswordCredentialRow,
): PasswordCredentialRecord {
  return {
    id: row.id,
    identityAccountId: row.identity_account_id,
    passwordHash: row.password_hash,
    passwordChangedAt: row.password_changed_at,
    failedAttemptCount: row.failed_attempt_count,
    lockedUntil: row.locked_until,
  };
}
