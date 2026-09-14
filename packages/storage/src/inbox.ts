import type { EventEnvelope } from "@crypto-wallet/shared-types";

import type { QueryResultRow } from "pg";

import type { Storage, StorageTransaction } from "./index.js";

export interface ConsumerInboxEventRecord {
  eventId: string;
  consumerName: string;
  eventType: string;
  eventVersion: number;
  occurredAt: Date;
  aggregateType: string;
  aggregateId: string;
  correlationId: string;
  payload: unknown;
  receivedAt: Date;
  processedAt: Date | null;
  attempts: number;
  lastError: string | null;
}

interface ConsumerInboxEventRow extends QueryResultRow {
  event_id: string;
  consumer_name: string;
  event_type: string;
  event_version: string | number;
  occurred_at: Date;
  aggregate_type: string;
  aggregate_id: string;
  correlation_id: string;
  payload: unknown;
  received_at: Date;
  processed_at: Date | null;
  attempts: number;
  last_error: string | null;
}

export interface DeadLetterEventRecord {
  eventId: string;
  consumerName: string;
  eventType: string;
  eventVersion: number;
  occurredAt: Date;
  aggregateType: string;
  aggregateId: string;
  correlationId: string;
  payload: unknown;
  failedAt: Date;
  attempts: number;
  lastError: string;
}

interface DeadLetterEventRow extends QueryResultRow {
  event_id: string;
  consumer_name: string;
  event_type: string;
  event_version: string | number;
  occurred_at: Date;
  aggregate_type: string;
  aggregate_id: string;
  correlation_id: string;
  payload: unknown;
  failed_at: Date;
  attempts: number;
  last_error: string;
}

export class InboxRepository {
  async recordReceived(
    transaction: StorageTransaction,
    consumerName: string,
    event: EventEnvelope,
  ): Promise<boolean> {
    const result = await transaction.query(
      `
        INSERT INTO consumer_inbox_events (
          event_id,
          consumer_name,
          event_type,
          event_version,
          occurred_at,
          aggregate_type,
          aggregate_id,
          correlation_id,
          payload
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (event_id, consumer_name) DO NOTHING
      `,
      [
        event.eventId,
        consumerName,
        event.eventType,
        event.eventVersion,
        event.occurredAt,
        event.aggregateType,
        event.aggregateId,
        event.correlationId,
        event.payload,
      ],
    );

    return result.rowCount === 1;
  }

  async markProcessed(
    transaction: StorageTransaction,
    eventId: string,
    consumerName: string,
  ): Promise<void> {
    await transaction.query(
      `
        UPDATE consumer_inbox_events
        SET processed_at = NOW(),
            last_error = NULL
        WHERE event_id = $1
          AND consumer_name = $2
          AND processed_at IS NULL
      `,
      [eventId, consumerName],
    );
  }

  async recordFailure(
    storage: Storage,
    eventId: string,
    consumerName: string,
    error: string,
  ): Promise<void> {
    await storage.query(
      `
        UPDATE consumer_inbox_events
        SET attempts = attempts + 1,
            last_error = $3
        WHERE event_id = $1
          AND consumer_name = $2
          AND processed_at IS NULL
      `,
      [eventId, consumerName, error],
    );
  }

  async find(
    storage: Storage,
    eventId: string,
    consumerName: string,
  ): Promise<ConsumerInboxEventRecord | null> {
    const result = await storage.query<ConsumerInboxEventRow>(
      `
        SELECT
          event_id,
          consumer_name,
          event_type,
          event_version,
          occurred_at,
          aggregate_type,
          aggregate_id,
          correlation_id,
          payload,
          received_at,
          processed_at,
          attempts,
          last_error
        FROM consumer_inbox_events
        WHERE event_id = $1
          AND consumer_name = $2
      `,
      [eventId, consumerName],
    );

    const row = result.rows[0];

    return row ? mapConsumerInboxEventRow(row) : null;
  }
}

export class DeadLetterRepository {
  async append(
    transaction: StorageTransaction,
    event: EventEnvelope,
    consumerName: string,
    attempts: number,
    error: string,
  ): Promise<void> {
    await transaction.query(
      `
        INSERT INTO dead_letter_events (
          event_id,
          consumer_name,
          event_type,
          event_version,
          occurred_at,
          aggregate_type,
          aggregate_id,
          correlation_id,
          payload,
          attempts,
          last_error
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (event_id, consumer_name)
        DO UPDATE SET
          failed_at = NOW(),
          attempts = EXCLUDED.attempts,
          last_error = EXCLUDED.last_error
      `,
      [
        event.eventId,
        consumerName,
        event.eventType,
        event.eventVersion,
        event.occurredAt,
        event.aggregateType,
        event.aggregateId,
        event.correlationId,
        event.payload,
        attempts,
        error,
      ],
    );
  }

  async find(
    storage: Storage,
    eventId: string,
    consumerName: string,
  ): Promise<DeadLetterEventRecord | null> {
    const result = await storage.query<DeadLetterEventRow>(
      `
        SELECT
          event_id,
          consumer_name,
          event_type,
          event_version,
          occurred_at,
          aggregate_type,
          aggregate_id,
          correlation_id,
          payload,
          failed_at,
          attempts,
          last_error
        FROM dead_letter_events
        WHERE event_id = $1
          AND consumer_name = $2
      `,
      [eventId, consumerName],
    );

    const row = result.rows[0];

    return row ? mapDeadLetterEventRow(row) : null;
  }
}

function mapConsumerInboxEventRow(row: ConsumerInboxEventRow): ConsumerInboxEventRecord {
  return {
    eventId: row.event_id,
    consumerName: row.consumer_name,
    eventType: row.event_type,
    eventVersion: Number(row.event_version),
    occurredAt: row.occurred_at,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    correlationId: row.correlation_id,
    payload: row.payload,
    receivedAt: row.received_at,
    processedAt: row.processed_at,
    attempts: row.attempts,
    lastError: row.last_error,
  };
}

function mapDeadLetterEventRow(row: DeadLetterEventRow): DeadLetterEventRecord {
  return {
    eventId: row.event_id,
    consumerName: row.consumer_name,
    eventType: row.event_type,
    eventVersion: Number(row.event_version),
    occurredAt: row.occurred_at,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    correlationId: row.correlation_id,
    payload: row.payload,
    failedAt: row.failed_at,
    attempts: row.attempts,
    lastError: row.last_error,
  };
}
