import type { EventEnvelope } from "@crypto-wallet/shared-types";

import type { QueryResultRow } from "pg";

import type { Storage, StorageTransaction } from "./index.js";

export interface OutboxEventRecord {
  eventId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: Date;
  aggregateType: string;
  aggregateId: string;
  correlationId: string;
  payload: unknown;
  availableAt: Date;
  publishedAt: Date | null;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  processingToken: string | null;
  processingUntil: Date | null;
}

interface OutboxEventRow extends QueryResultRow {
  event_id: string;
  event_type: string;
  event_version: string | number;
  occurred_at: Date;
  aggregate_type: string;
  aggregate_id: string;
  correlation_id: string;
  payload: unknown;
  available_at: Date;
  published_at: Date | null;
  attempts: number;
  last_error: string | null;
  created_at: Date;
  processing_token: string | null;
  processing_until: Date | null;
}

export class OutboxRepository {
  async append(transaction: StorageTransaction, event: EventEnvelope): Promise<void> {
    await transaction.query(
      `
        INSERT INTO outbox_events (
          event_id,
          event_type,
          event_version,
          occurred_at,
          aggregate_type,
          aggregate_id,
          correlation_id,
          payload
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        event.eventId,
        event.eventType,
        event.eventVersion,
        event.occurredAt,
        event.aggregateType,
        event.aggregateId,
        event.correlationId,
        event.payload,
      ],
    );
  }

  async claimUnpublished(
    storage: Storage,
    processingToken: string,
    limit = 100,
    leaseMs = 30_000,
  ): Promise<OutboxEventRecord[]> {
    const result = await storage.query<OutboxEventRow>(
      `
        WITH candidates AS (
          SELECT event_id
          FROM outbox_events
          WHERE published_at IS NULL
            AND available_at <= NOW()
            AND (
              processing_until IS NULL
              OR processing_until <= NOW()
            )
          ORDER BY occurred_at ASC, event_id ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE outbox_events AS events
        SET processing_token = $2,
            processing_until = NOW() + ($3 * INTERVAL '1 millisecond')
        FROM candidates
        WHERE events.event_id = candidates.event_id
        RETURNING
          events.event_id,
          events.event_type,
          events.event_version,
          events.occurred_at,
          events.aggregate_type,
          events.aggregate_id,
          events.correlation_id,
          events.payload,
          events.available_at,
          events.published_at,
          events.attempts,
          events.last_error,
          events.created_at,
          events.processing_token,
          events.processing_until
      `,
      [limit, processingToken, leaseMs],
    );

    return result.rows.map(mapOutboxEventRow);
  }

  async markPublished(storage: Storage, eventId: string, processingToken: string): Promise<void> {
    await storage.query(
      `
        UPDATE outbox_events
        SET published_at = NOW(),
            last_error = NULL,
            processing_token = NULL,
            processing_until = NULL
        WHERE event_id = $1
          AND processing_token = $2
          AND published_at IS NULL
      `,
      [eventId, processingToken],
    );
  }

  async recordFailure(
    storage: Storage,
    eventId: string,
    processingToken: string,
    error: string,
    retryAt: Date,
  ): Promise<void> {
    await storage.query(
      `
        UPDATE outbox_events
        SET attempts = attempts + 1,
            last_error = $3,
            available_at = $4,
            processing_token = NULL,
            processing_until = NULL
        WHERE event_id = $1
          AND processing_token = $2
          AND published_at IS NULL
      `,
      [eventId, processingToken, error, retryAt],
    );
  }
}

function mapOutboxEventRow(row: OutboxEventRow): OutboxEventRecord {
  return {
    eventId: row.event_id,
    eventType: row.event_type,
    eventVersion: Number(row.event_version),
    occurredAt: row.occurred_at,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    correlationId: row.correlation_id,
    payload: row.payload,
    availableAt: row.available_at,
    publishedAt: row.published_at,
    attempts: row.attempts,
    lastError: row.last_error,
    createdAt: row.created_at,
    processingToken: row.processing_token,
    processingUntil: row.processing_until,
  };
}
