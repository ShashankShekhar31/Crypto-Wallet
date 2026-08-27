import { randomUUID } from "node:crypto";

import type { Storage } from "@crypto-wallet/storage";

export interface PasskeyCredentialRecord {
  id: string;
  identityAccountId: string;
  credentialId: Buffer;
  publicKey: Buffer;
  signCount: number;
  backedUp: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

interface PasskeyCredentialRow {
  id: string;
  identity_account_id: string;
  credential_id: Buffer;
  public_key: Buffer;
  sign_count: number;
  backed_up: boolean;
  created_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
}

export interface CreatePasskeyCredentialInput {
  identityAccountId: string;
  credentialId: Buffer;
  publicKey: Buffer;
  signCount?: number;
  backedUp?: boolean;
}

export class PasskeyRepository {
  constructor(private readonly storage: Storage) {}

  async findByCredentialId(
    credentialId: Buffer,
  ): Promise<PasskeyCredentialRecord | null> {
    const result =
      await this.storage.query<PasskeyCredentialRow>(
        `
          SELECT
            id,
            identity_account_id,
            credential_id,
            public_key,
            sign_count,
            backed_up,
            created_at,
            last_used_at,
            revoked_at
          FROM passkey_credentials
          WHERE credential_id = $1
          LIMIT 1
        `,
        [credentialId],
      );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapPasskeyCredential(row);
  }

  async findActiveByIdentityAccountId(
  identityAccountId: string,
): Promise<PasskeyCredentialRecord[]> {
  const result =
    await this.storage.query<PasskeyCredentialRow>(
      `
        SELECT
          id,
          identity_account_id,
          credential_id,
          public_key,
          sign_count,
          backed_up,
          created_at,
          last_used_at,
          revoked_at
        FROM passkey_credentials
        WHERE identity_account_id = $1
          AND revoked_at IS NULL
        ORDER BY created_at ASC
      `,
      [identityAccountId],
    );

  return result.rows.map(mapPasskeyCredential);
}

  async createCredential(
    input: CreatePasskeyCredentialInput,
  ): Promise<PasskeyCredentialRecord> {
    const id = randomUUID();

    const result =
      await this.storage.query<PasskeyCredentialRow>(
        `
          INSERT INTO passkey_credentials (
            id,
            identity_account_id,
            credential_id,
            public_key,
            sign_count,
            backed_up
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
          )
          RETURNING
            id,
            identity_account_id,
            credential_id,
            public_key,
            sign_count,
            backed_up,
            created_at,
            last_used_at,
            revoked_at
        `,
        [
          id,
          input.identityAccountId,
          input.credentialId,
          input.publicKey,
          input.signCount ?? 0,
          input.backedUp ?? false,
        ],
      );

    const row = result.rows[0];

    if (!row) {
      throw new Error(
        "Failed to create passkey credential",
      );
    }

    return mapPasskeyCredential(row);
  }

  async updateSignCount(
    passkeyId: string,
    signCount: number,
  ): Promise<PasskeyCredentialRecord | null> {
    const result =
      await this.storage.query<PasskeyCredentialRow>(
        `
          UPDATE passkey_credentials
          SET sign_count = $2
          WHERE id = $1
            AND sign_count < $2
            AND revoked_at IS NULL
          RETURNING
            id,
            identity_account_id,
            credential_id,
            public_key,
            sign_count,
            backed_up,
            created_at,
            last_used_at,
            revoked_at
        `,
        [passkeyId, signCount],
      );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapPasskeyCredential(row);
  }

  async markUsed(
    credentialId: string,
  ): Promise<PasskeyCredentialRecord | null> {
    const result =
      await this.storage.query<PasskeyCredentialRow>(
        `
          UPDATE passkey_credentials
          SET last_used_at = NOW()
          WHERE id = $1
            AND revoked_at IS NULL
          RETURNING
            id,
            identity_account_id,
            credential_id,
            public_key,
            sign_count,
            backed_up,
            created_at,
            last_used_at,
            revoked_at
        `,
        [credentialId],
      );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapPasskeyCredential(row);
  }

  async revokeCredential(
    credentialId: string,
  ): Promise<PasskeyCredentialRecord | null> {
    const result =
      await this.storage.query<PasskeyCredentialRow>(
        `
          UPDATE passkey_credentials
          SET revoked_at = COALESCE(revoked_at, NOW())
          WHERE id = $1
            AND revoked_at IS NULL
          RETURNING
            id,
            identity_account_id,
            credential_id,
            public_key,
            sign_count,
            backed_up,
            created_at,
            last_used_at,
            revoked_at
        `,
        [credentialId],
      );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapPasskeyCredential(row);
  }
}

function mapPasskeyCredential(
  row: PasskeyCredentialRow,
): PasskeyCredentialRecord {
  return {
    id: row.id,
    identityAccountId: row.identity_account_id,
    credentialId: row.credential_id,
    publicKey: row.public_key,
    signCount: Number(row.sign_count),
    backedUp: row.backed_up,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
}