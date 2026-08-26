import { randomUUID } from "node:crypto";

import type { Storage } from "@crypto-wallet/storage";

export type AuthSessionStatus =
  | "active"
  | "rotated"
  | "revoked"
  | "expired"
  | "replay_detected";

export interface AuthSessionRecord {
  id: string;
  userId: string;
  deviceId: string;
  tokenFamilyId: string;
  refreshTokenHash: string;
  status: AuthSessionStatus;
  issuedAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  idleExpiresAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  revokedReason: string | null;
  replacedBySessionId: string | null;
}

interface AuthSessionRow {
  id: string;
  user_id: string;
  device_id: string;
  token_family_id: string;
  refresh_token_hash: string;
  status: AuthSessionStatus;
  issued_at: Date;
  last_seen_at: Date;
  expires_at: Date;
  idle_expires_at: Date;
  rotated_at: Date | null;
  revoked_at: Date | null;
  revoked_reason: string | null;
  replaced_by_session_id: string | null;
}

export interface CreateAuthSessionInput {
  userId: string;
  deviceId: string;
  tokenFamilyId?: string;
  refreshTokenHash: string;
  expiresAt: Date;
  idleExpiresAt: Date;
}

export class SessionRepository {
  constructor(private readonly storage: Storage) {}

  async createSession(
    input: CreateAuthSessionInput,
  ): Promise<AuthSessionRecord> {
    const sessionId = randomUUID();
    const tokenFamilyId =
      input.tokenFamilyId ?? randomUUID();

    const result = await this.storage.query<AuthSessionRow>(
      `
        INSERT INTO auth_sessions (
          id,
          user_id,
          device_id,
          token_family_id,
          refresh_token_hash,
          status,
          expires_at,
          idle_expires_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          'active',
          $6,
          $7
        )
        RETURNING
          id,
          user_id,
          device_id,
          token_family_id,
          refresh_token_hash,
          status,
          issued_at,
          last_seen_at,
          expires_at,
          idle_expires_at,
          rotated_at,
          revoked_at,
          revoked_reason,
          replaced_by_session_id
      `,
      [
        sessionId,
        input.userId,
        input.deviceId,
        tokenFamilyId,
        input.refreshTokenHash,
        input.expiresAt,
        input.idleExpiresAt,
      ],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to create auth session");
    }

    return mapAuthSession(row);
  }

  async findByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<AuthSessionRecord | null> {
    const result = await this.storage.query<AuthSessionRow>(
      `
        SELECT
          id,
          user_id,
          device_id,
          token_family_id,
          refresh_token_hash,
          status,
          issued_at,
          last_seen_at,
          expires_at,
          idle_expires_at,
          rotated_at,
          revoked_at,
          revoked_reason,
          replaced_by_session_id
        FROM auth_sessions
        WHERE refresh_token_hash = $1
        LIMIT 1
      `,
      [refreshTokenHash],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapAuthSession(row);
  }

  async revokeSession(
    sessionId: string,
    reason: string,
  ): Promise<AuthSessionRecord | null> {
    const result = await this.storage.query<AuthSessionRow>(
      `
        UPDATE auth_sessions
        SET
          status = 'revoked',
          revoked_at = COALESCE(revoked_at, NOW()),
          revoked_reason = $2
        WHERE id = $1
          AND status = 'active'
        RETURNING
          id,
          user_id,
          device_id,
          token_family_id,
          refresh_token_hash,
          status,
          issued_at,
          last_seen_at,
          expires_at,
          idle_expires_at,
          rotated_at,
          revoked_at,
          revoked_reason,
          replaced_by_session_id
      `,
      [sessionId, reason],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapAuthSession(row);
  }

  async rotateSession(
  sessionId: string,
  replacement: CreateAuthSessionInput,
): Promise<{
  previousSession: AuthSessionRecord;
  replacementSession: AuthSessionRecord;
}> {
  return this.storage.transaction(async (transaction) => {
    const previousResult =
      await transaction.query<AuthSessionRow>(
        `
          UPDATE auth_sessions
          SET
            status = 'rotated',
            rotated_at = NOW()
          WHERE id = $1
            AND status = 'active'
          RETURNING
            id,
            user_id,
            device_id,
            token_family_id,
            refresh_token_hash,
            status,
            issued_at,
            last_seen_at,
            expires_at,
            idle_expires_at,
            rotated_at,
            revoked_at,
            revoked_reason,
            replaced_by_session_id
        `,
        [sessionId],
      );

    const previousRow = previousResult.rows[0];

    if (!previousRow) {
      throw new Error(
        "Active auth session not found",
      );
    }

    const replacementSessionId = randomUUID();

    const tokenFamilyId =
      replacement.tokenFamilyId ??
      previousRow.token_family_id;

    const replacementResult =
      await transaction.query<AuthSessionRow>(
        `
          INSERT INTO auth_sessions (
            id,
            user_id,
            device_id,
            token_family_id,
            refresh_token_hash,
            status,
            expires_at,
            idle_expires_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            'active',
            $6,
            $7
          )
          RETURNING
            id,
            user_id,
            device_id,
            token_family_id,
            refresh_token_hash,
            status,
            issued_at,
            last_seen_at,
            expires_at,
            idle_expires_at,
            rotated_at,
            revoked_at,
            revoked_reason,
            replaced_by_session_id
        `,
        [
          replacementSessionId,
          replacement.userId,
          replacement.deviceId,
          tokenFamilyId,
          replacement.refreshTokenHash,
          replacement.expiresAt,
          replacement.idleExpiresAt,
        ],
      );

    const replacementRow =
      replacementResult.rows[0];

    if (!replacementRow) {
      throw new Error(
        "Failed to create replacement auth session",
      );
    }

    const linkedResult =
      await transaction.query<AuthSessionRow>(
        `
          UPDATE auth_sessions
          SET replaced_by_session_id = $2
          WHERE id = $1
          RETURNING
            id,
            user_id,
            device_id,
            token_family_id,
            refresh_token_hash,
            status,
            issued_at,
            last_seen_at,
            expires_at,
            idle_expires_at,
            rotated_at,
            revoked_at,
            revoked_reason,
            replaced_by_session_id
        `,
        [
          sessionId,
          replacementSessionId,
        ],
      );

    const linkedRow = linkedResult.rows[0];

    if (!linkedRow) {
      throw new Error(
        "Failed to link rotated auth session",
      );
    }

    return {
      previousSession: mapAuthSession(linkedRow),
      replacementSession:
        mapAuthSession(replacementRow),
    };
  });
}
}

function mapAuthSession(
  row: AuthSessionRow,
): AuthSessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    deviceId: row.device_id,
    tokenFamilyId: row.token_family_id,
    refreshTokenHash: row.refresh_token_hash,
    status: row.status,
    issuedAt: row.issued_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    idleExpiresAt: row.idle_expires_at,
    rotatedAt: row.rotated_at,
    revokedAt: row.revoked_at,
    revokedReason: row.revoked_reason,
    replacedBySessionId: row.replaced_by_session_id,
  };
}
