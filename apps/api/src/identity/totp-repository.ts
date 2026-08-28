import { randomUUID } from "node:crypto";

import type { Storage } from "@crypto-wallet/storage";

export interface TotpFactorRecord {
  id: string;
  identityAccountId: string;
  encryptedSecret: Buffer;
  secretNonce: Buffer;
  encryptionKeyVersion: string;
  createdAt: Date;
  enabledAt: Date | null;
  disabledAt: Date | null;
}

interface TotpFactorRow {
  id: string;
  identity_account_id: string;
  encrypted_secret: Buffer;
  secret_nonce: Buffer;
  encryption_key_version: string;
  created_at: Date;
  enabled_at: Date | null;
  disabled_at: Date | null;
}

export interface CreateTotpFactorInput {
  identityAccountId: string;
  encryptedSecret: Buffer;
  secretNonce: Buffer;
  encryptionKeyVersion: string;
}

export class TotpRepository {
  constructor(private readonly storage: Storage) {}

  async createFactor(input: CreateTotpFactorInput): Promise<TotpFactorRecord> {
    if (input.encryptedSecret.length === 0) {
      throw new Error("Encrypted TOTP secret is required");
    }

    if (input.secretNonce.length === 0) {
      throw new Error("TOTP secret nonce is required");
    }

    if (input.encryptionKeyVersion.trim().length === 0) {
      throw new Error("TOTP encryption key version is required");
    }

    const id = randomUUID();

    const result = await this.storage.query<TotpFactorRow>(
      `
          INSERT INTO totp_factors (
            id,
            identity_account_id,
            encrypted_secret,
            secret_nonce,
            encryption_key_version
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5
          )
          RETURNING
            id,
            identity_account_id,
            encrypted_secret,
            secret_nonce,
            encryption_key_version,
            created_at,
            enabled_at,
            disabled_at
        `,
      [
        id,
        input.identityAccountId,
        input.encryptedSecret,
        input.secretNonce,
        input.encryptionKeyVersion,
      ],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to create TOTP factor");
    }

    return mapTotpFactor(row);
  }

  async findById(factorId: string): Promise<TotpFactorRecord | null> {
    const result = await this.storage.query<TotpFactorRow>(
      `
          SELECT
            id,
            identity_account_id,
            encrypted_secret,
            secret_nonce,
            encryption_key_version,
            created_at,
            enabled_at,
            disabled_at
          FROM totp_factors
          WHERE id = $1
          LIMIT 1
        `,
      [factorId],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapTotpFactor(row);
  }

  async findActiveByIdentityAccountId(identityAccountId: string): Promise<TotpFactorRecord | null> {
    const result = await this.storage.query<TotpFactorRow>(
      `
          SELECT
            id,
            identity_account_id,
            encrypted_secret,
            secret_nonce,
            encryption_key_version,
            created_at,
            enabled_at,
            disabled_at
          FROM totp_factors
          WHERE identity_account_id = $1
            AND enabled_at IS NOT NULL
            AND disabled_at IS NULL
          ORDER BY created_at DESC
          LIMIT 1
        `,
      [identityAccountId],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapTotpFactor(row);
  }

  async enableFactor(factorId: string): Promise<TotpFactorRecord | null> {
    const result = await this.storage.query<TotpFactorRow>(
      `
          UPDATE totp_factors
          SET
            enabled_at = COALESCE(enabled_at, NOW()),
            disabled_at = NULL
          WHERE id = $1
          RETURNING
            id,
            identity_account_id,
            encrypted_secret,
            secret_nonce,
            encryption_key_version,
            created_at,
            enabled_at,
            disabled_at
        `,
      [factorId],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapTotpFactor(row);
  }

  async disableFactor(factorId: string): Promise<TotpFactorRecord | null> {
    const result = await this.storage.query<TotpFactorRow>(
      `
          UPDATE totp_factors
          SET
            disabled_at = COALESCE(disabled_at, NOW())
          WHERE id = $1
            AND disabled_at IS NULL
          RETURNING
            id,
            identity_account_id,
            encrypted_secret,
            secret_nonce,
            encryption_key_version,
            created_at,
            enabled_at,
            disabled_at
        `,
      [factorId],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapTotpFactor(row);
  }
}

function mapTotpFactor(row: TotpFactorRow): TotpFactorRecord {
  return {
    id: row.id,
    identityAccountId: row.identity_account_id,
    encryptedSecret: row.encrypted_secret,
    secretNonce: row.secret_nonce,
    encryptionKeyVersion: row.encryption_key_version,
    createdAt: row.created_at,
    enabledAt: row.enabled_at,
    disabledAt: row.disabled_at,
  };
}
