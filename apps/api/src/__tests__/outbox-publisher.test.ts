import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import type { EventEnvelope } from "@crypto-wallet/shared-types";
import { PostgresStorage, OutboxRepository } from "@crypto-wallet/storage";

import type { EventPublisher } from "../messaging/event-publisher.js";
import { OutboxPublisher } from "../messaging/outbox-publisher.js";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required for outbox publisher tests");
}

class FakeEventPublisher implements EventPublisher {
  readonly publishedEvents: EventEnvelope[] = [];

  constructor(private readonly failure?: Error) {}

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {}

  async publish(event: EventEnvelope): Promise<void> {
    if (this.failure) {
      throw this.failure;
    }

    this.publishedEvents.push(event);
  }
}

describe("OutboxPublisher", () => {
  const storage = new PostgresStorage(DATABASE_URL);
  const repository = new OutboxRepository();
  const eventIds: string[] = [];

  afterEach(async () => {
    if (eventIds.length > 0) {
      await storage.query(
        `
          DELETE FROM outbox_events
          WHERE event_id = ANY($1::uuid[])
        `,
        [eventIds.splice(0)],
      );
    }
  });

  it("publishes pending events and marks them as published", async () => {
    const eventId = randomUUID();
    eventIds.push(eventId);

    const event: EventEnvelope = {
      eventId,
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
        transactionHash: "0x-outbox-test",
        amount: "1.50000000",
      },
    };

    await storage.transaction(async (transaction) => {
      await repository.append(transaction, event);
    });

    const publisher = new FakeEventPublisher();

    const relay = new OutboxPublisher(storage, publisher, {
      repository,
    });

    const result = await relay.publishPending();

    expect(result).toEqual({
      published: 1,
      failed: 0,
    });

    expect(publisher.publishedEvents).toEqual([event]);

    const stored = await storage.query<{
      published_at: Date | null;
      attempts: number;
      last_error: string | null;
    }>(
      `
        SELECT published_at, attempts, last_error
        FROM outbox_events
        WHERE event_id = $1
      `,
      [eventId],
    );

    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0]?.published_at).not.toBeNull();
    expect(stored.rows[0]?.attempts).toBe(0);
    expect(stored.rows[0]?.last_error).toBeNull();
  });

  it("records a failure and schedules a retry when publishing fails", async () => {
    const eventId = randomUUID();
    eventIds.push(eventId);

    const event: EventEnvelope = {
      eventId,
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
        transactionHash: "0x-outbox-failure-test",
        amount: "2.00000000",
      },
    };

    await storage.transaction(async (transaction) => {
      await repository.append(transaction, event);
    });

    const publisherError = new Error("Redpanda unavailable");
    const publisher = new FakeEventPublisher(publisherError);

    const relay = new OutboxPublisher(storage, publisher, {
      repository,
      retryBaseDelayMs: 10,
    });

    const before = Date.now();

    const result = await relay.publishPending();

    const after = Date.now();

    expect(result).toEqual({
      published: 0,
      failed: 1,
    });

    const stored = await storage.query<{
      published_at: Date | null;
      attempts: number;
      last_error: string | null;
      available_at: Date;
    }>(
      `
        SELECT published_at, attempts, last_error, available_at
        FROM outbox_events
        WHERE event_id = $1
      `,
      [eventId],
    );

    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0]?.published_at).toBeNull();
    expect(stored.rows[0]?.attempts).toBe(1);
    expect(stored.rows[0]?.last_error).toBe("Redpanda unavailable");

    const retryAt = stored.rows[0]?.available_at.getTime();

    expect(retryAt).toBeGreaterThanOrEqual(before + 2);
    expect(retryAt).toBeLessThanOrEqual(after + 2_000);
  });

  it("does not publish events that are already marked as published", async () => {
    const eventId = randomUUID();
    eventIds.push(eventId);

    const event: EventEnvelope = {
      eventId,
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
        transactionHash: "0x-already-published",
        amount: "3.00000000",
      },
    };

    await storage.transaction(async (transaction) => {
      await repository.append(transaction, event);
    });

    await storage.query(
      `
    UPDATE outbox_events
    SET published_at = NOW()
    WHERE event_id = $1
  `,
      [eventId],
    );

    const publisher = new FakeEventPublisher();

    const relay = new OutboxPublisher(storage, publisher, {
      repository,
    });

    const result = await relay.publishPending();

    expect(result).toEqual({
      published: 0,
      failed: 0,
    });

    expect(publisher.publishedEvents).toHaveLength(0);
  });
});
