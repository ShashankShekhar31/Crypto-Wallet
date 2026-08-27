import { randomUUID } from "node:crypto";

import type { Storage } from "@crypto-wallet/storage";

export type AuthEventOutcome =
  | "success"
  | "failure"
  | "blocked"
  | "suspicious";

export interface RecordAuthEventInput {
  userId?: string | null;
  deviceId?: string | null;
  sessionId?: string | null;

  eventType: string;
  outcome: AuthEventOutcome;

  sourceIpHash?: string | null;
  userAgent?: string | null;
  failureCode?: string | null;
}

export interface AuthEventRecord {
  id: string;

  userId: string | null;
  deviceId: string | null;
  sessionId: string | null;

  eventType: string;
  outcome: AuthEventOutcome;

  sourceIpHash: string | null;
  userAgent: string | null;
  failureCode: string | null;

  occurredAt: Date;
}

interface AuthEventRow {
  id: string;

  user_id: string | null;
  device_id: string | null;
  session_id: string | null;

  event_type: string;
  outcome: AuthEventOutcome;

  source_ip_hash: string | null;
  user_agent: string | null;
  failure_code: string | null;

  occurred_at: Date;
}

export class AuthEventRepository {
  constructor(private readonly storage: Storage) {}

  async record(
    input: RecordAuthEventInput,
  ): Promise<AuthEventRecord> {
    const id = randomUUID();

    const result = await this.storage.query<AuthEventRow>(
      `
        INSERT INTO auth_events (
          id,
          user_id,
          device_id,
          session_id,
          event_type,
          outcome,
          source_ip_hash,
          user_agent,
          failure_code
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9
        )
        RETURNING
          id,
          user_id,
          device_id,
          session_id,
          event_type,
          outcome,
          source_ip_hash,
          user_agent,
          failure_code,
          occurred_at
      `,
      [
        id,
        input.userId ?? null,
        input.deviceId ?? null,
        input.sessionId ?? null,
        input.eventType,
        input.outcome,
        input.sourceIpHash ?? null,
        input.userAgent ?? null,
        input.failureCode ?? null,
      ],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to record auth event");
    }

    return mapAuthEvent(row);
  }
    async hasSuccessfulLoginForDevice(
    userId: string,
    deviceId: string,
  ): Promise<boolean> {
    const result = await this.storage.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM auth_events
          WHERE user_id = $1
            AND device_id = $2
            AND event_type = 'password_login'
            AND outcome = 'success'
        ) AS exists
      `,
      [userId, deviceId],
    );

    return result.rows[0]?.exists ?? false;
  }

  async countRecentFailuresByIp(
    sourceIpHash: string,
    windowMs: number,
  ): Promise<number> {
    if (windowMs <= 0) {
      throw new Error("Invalid auth event window");
    }

    const result = await this.storage.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM auth_events
        WHERE source_ip_hash = $1
          AND event_type = 'password_login'
          AND outcome = 'failure'
          AND occurred_at >= NOW() - ($2 * INTERVAL '1 millisecond')
      `,
      [sourceIpHash, windowMs],
    );

    return Number(result.rows[0]?.count ?? "0");
  }
}

function mapAuthEvent(row: AuthEventRow): AuthEventRecord {
  return {
    id: row.id,

    userId: row.user_id,
    deviceId: row.device_id,
    sessionId: row.session_id,

    eventType: row.event_type,
    outcome: row.outcome,

    sourceIpHash: row.source_ip_hash,
    userAgent: row.user_agent,
    failureCode: row.failure_code,

    occurredAt: row.occurred_at,
  };
}
