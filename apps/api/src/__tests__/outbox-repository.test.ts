import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { OutboxRepository, PostgresStorage } from "@crypto-wallet/storage";
import type { ExchangeDepositCreatedEvent } from "@crypto-wallet/shared-types";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for outbox repository tests");
}

function createEvent(): ExchangeDepositCreatedEvent {
  return {
    eventId: randomUUID(),
    eventType: "exchange.deposit.created",
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    aggregateType: "exchange_deposit",
    aggregateId: randomUUID(),
    correlationId: randomUUID(),
    payload: {
      depositId: randomUUID(),
      exchangeAccountId: randomUUID(),
      assetAccountId: randomUUID(),
      transactionHash: `0x${randomUUID().replaceAll("-", "")}`,
      amount: "1.25000000",
    },
  };
}

describe("OutboxRepository", () => {
  it("appends an event atomically inside a transaction", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new OutboxRepository();
    const event = createEvent();

    try {
      await storage.connect();

      await storage.transaction(async (transaction) => {
        await repository.append(transaction, event);
      });

      const processingToken = randomUUID();

      const events = await repository.claimUnpublished(storage, processingToken);

      const persisted = events.find((candidate) => candidate.eventId === event.eventId);

      expect(persisted).toBeDefined();
      expect(persisted?.eventType).toBe(event.eventType);
      expect(persisted?.eventVersion).toBe(event.eventVersion);
      expect(persisted?.aggregateType).toBe(event.aggregateType);
      expect(persisted?.aggregateId).toBe(event.aggregateId);
      expect(persisted?.correlationId).toBe(event.correlationId);
      expect(persisted?.payload).toEqual(event.payload);
      expect(persisted?.publishedAt).toBeNull();
      expect(persisted?.attempts).toBe(0);
      expect(persisted?.lastError).toBeNull();
      expect(persisted?.processingToken).toBe(processingToken);
      expect(persisted?.processingUntil).toBeInstanceOf(Date);
    } finally {
      await storage.query(
        `
          DELETE FROM outbox_events
          WHERE event_id = $1
        `,
        [event.eventId],
      );

      await storage.disconnect();
    }
  });

  it("rolls back the outbox event when the surrounding transaction fails", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new OutboxRepository();
    const event = createEvent();

    try {
      await storage.connect();

      await expect(
        storage.transaction(async (transaction) => {
          await repository.append(transaction, event);

          throw new Error("intentional outbox transaction failure");
        }),
      ).rejects.toThrow("intentional outbox transaction failure");

      const result = await storage.query<{ event_id: string }>(
        `
          SELECT event_id
          FROM outbox_events
          WHERE event_id = $1
        `,
        [event.eventId],
      );

      expect(result.rows).toHaveLength(0);
    } finally {
      await storage.query(
        `
          DELETE FROM outbox_events
          WHERE event_id = $1
        `,
        [event.eventId],
      );

      await storage.disconnect();
    }
  });

  it("marks an unpublished event as published", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new OutboxRepository();
    const event = createEvent();

    try {
      await storage.connect();

      await storage.transaction(async (transaction) => {
        await repository.append(transaction, event);
      });

      const processingToken = randomUUID();

      const claimed = await repository.claimUnpublished(storage, processingToken);

      expect(claimed).toHaveLength(1);
      expect(claimed[0]?.eventId).toBe(event.eventId);

      await repository.markPublished(storage, event.eventId, processingToken);

      const result = await storage.query<{
        published_at: Date | null;
        last_error: string | null;
      }>(
        `
          SELECT published_at, last_error
          FROM outbox_events
          WHERE event_id = $1
        `,
        [event.eventId],
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.published_at).toBeInstanceOf(Date);
      expect(result.rows[0]?.last_error).toBeNull();
    } finally {
      await storage.query(
        `
          DELETE FROM outbox_events
          WHERE event_id = $1
        `,
        [event.eventId],
      );

      await storage.disconnect();
    }
  });

  it("records a publish failure and schedules a retry", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new OutboxRepository();
    const event = createEvent();
    const retryAt = new Date(Date.now() + 60_000);

    try {
      await storage.connect();

      await storage.transaction(async (transaction) => {
        await repository.append(transaction, event);
      });

      const processingToken = randomUUID();

      const claimed = await repository.claimUnpublished(storage, processingToken);

      expect(claimed).toHaveLength(1);
      expect(claimed[0]?.eventId).toBe(event.eventId);

      await repository.recordFailure(
        storage,
        event.eventId,
        processingToken,
        "temporary broker unavailable",
        retryAt,
      );

      const result = await storage.query<{
        attempts: number;
        last_error: string | null;
        available_at: Date;
        published_at: Date | null;
        processing_token: string | null;
        processing_until: Date | null;
      }>(
        `
    SELECT
      attempts,
      last_error,
      available_at,
      published_at,
      processing_token,
      processing_until
    FROM outbox_events
    WHERE event_id = $1
  `,
        [event.eventId],
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.attempts).toBe(1);
      expect(result.rows[0]?.last_error).toBe("temporary broker unavailable");
      expect(result.rows[0]?.available_at).toBeInstanceOf(Date);
      expect(result.rows[0]?.available_at.getTime()).toBe(retryAt.getTime());
      expect(result.rows[0]?.published_at).toBeNull();
      expect(result.rows[0]?.processing_token).toBeNull();
      expect(result.rows[0]?.processing_until).toBeNull();
    } finally {
      await storage.query(
        `
          DELETE FROM outbox_events
          WHERE event_id = $1
        `,
        [event.eventId],
      );

      await storage.disconnect();
    }
  });
});
