import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { DeadLetterRepository, InboxRepository, PostgresStorage } from "@crypto-wallet/storage";
import type { ExchangeDepositCreatedEvent } from "@crypto-wallet/shared-types";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for inbox repository tests");
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

describe("InboxRepository", () => {
  it("records the first delivery and rejects duplicate delivery for the same consumer", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new InboxRepository();
    const event = createEvent();
    const consumerName = `test-consumer-${randomUUID()}`;

    try {
      await storage.connect();

      const first = await storage.transaction(async (transaction) =>
        repository.recordReceived(transaction, consumerName, event),
      );

      const duplicate = await storage.transaction(async (transaction) =>
        repository.recordReceived(transaction, consumerName, event),
      );

      expect(first).toBe(true);
      expect(duplicate).toBe(false);

      const persisted = await repository.find(storage, event.eventId, consumerName);

      expect(persisted).toBeDefined();
      expect(persisted?.eventId).toBe(event.eventId);
      expect(persisted?.consumerName).toBe(consumerName);
      expect(persisted?.eventType).toBe(event.eventType);
      expect(persisted?.payload).toEqual(event.payload);
      expect(persisted?.processedAt).toBeNull();
      expect(persisted?.attempts).toBe(0);
      expect(persisted?.lastError).toBeNull();
    } finally {
      await storage.query(
        `
          DELETE FROM consumer_inbox_events
          WHERE event_id = $1
            AND consumer_name = $2
        `,
        [event.eventId, consumerName],
      );

      await storage.disconnect();
    }
  });

  it("allows the same event to be recorded independently by different consumers", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new InboxRepository();
    const event = createEvent();
    const consumerA = `test-consumer-a-${randomUUID()}`;
    const consumerB = `test-consumer-b-${randomUUID()}`;

    try {
      await storage.connect();

      const first = await storage.transaction(async (transaction) =>
        repository.recordReceived(transaction, consumerA, event),
      );

      const second = await storage.transaction(async (transaction) =>
        repository.recordReceived(transaction, consumerB, event),
      );

      expect(first).toBe(true);
      expect(second).toBe(true);

      const result = await storage.query<{ event_id: string; consumer_name: string }>(
        `
          SELECT event_id, consumer_name
          FROM consumer_inbox_events
          WHERE event_id = $1
            AND consumer_name IN ($2, $3)
          ORDER BY consumer_name
        `,
        [event.eventId, consumerA, consumerB],
      );

      expect(result.rows).toHaveLength(2);
    } finally {
      await storage.query(
        `
          DELETE FROM consumer_inbox_events
          WHERE event_id = $1
            AND consumer_name IN ($2, $3)
        `,
        [event.eventId, consumerA, consumerB],
      );

      await storage.disconnect();
    }
  });

  it("marks a received event as processed", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new InboxRepository();
    const event = createEvent();
    const consumerName = `test-consumer-${randomUUID()}`;

    try {
      await storage.connect();

      await storage.transaction(async (transaction) => {
        await repository.recordReceived(transaction, consumerName, event);
      });

      await storage.transaction(async (transaction) => {
        await repository.markProcessed(transaction, event.eventId, consumerName);
      });

      const persisted = await repository.find(storage, event.eventId, consumerName);

      expect(persisted?.processedAt).toBeInstanceOf(Date);
      expect(persisted?.lastError).toBeNull();
    } finally {
      await storage.query(
        `
          DELETE FROM consumer_inbox_events
          WHERE event_id = $1
            AND consumer_name = $2
        `,
        [event.eventId, consumerName],
      );

      await storage.disconnect();
    }
  });

  it("records a processing failure", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new InboxRepository();
    const event = createEvent();
    const consumerName = `test-consumer-${randomUUID()}`;

    try {
      await storage.connect();

      await storage.transaction(async (transaction) => {
        await repository.recordReceived(transaction, consumerName, event);
      });

      await repository.recordFailure(
        storage,
        event.eventId,
        consumerName,
        "temporary downstream failure",
      );

      const persisted = await repository.find(storage, event.eventId, consumerName);

      expect(persisted?.attempts).toBe(1);
      expect(persisted?.lastError).toBe("temporary downstream failure");
      expect(persisted?.processedAt).toBeNull();
    } finally {
      await storage.query(
        `
          DELETE FROM consumer_inbox_events
          WHERE event_id = $1
            AND consumer_name = $2
        `,
        [event.eventId, consumerName],
      );

      await storage.disconnect();
    }
  });
});

describe("DeadLetterRepository", () => {
  it("persists a failed event in the dead-letter store", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new DeadLetterRepository();
    const event = createEvent();
    const consumerName = `test-consumer-${randomUUID()}`;

    try {
      await storage.connect();

      await storage.transaction(async (transaction) => {
        await repository.append(
          transaction,
          event,
          consumerName,
          5,
          "maximum retry attempts exceeded",
        );
      });

      const persisted = await repository.find(storage, event.eventId, consumerName);

      expect(persisted).toBeDefined();
      expect(persisted?.eventId).toBe(event.eventId);
      expect(persisted?.consumerName).toBe(consumerName);
      expect(persisted?.eventType).toBe(event.eventType);
      expect(persisted?.payload).toEqual(event.payload);
      expect(persisted?.attempts).toBe(5);
      expect(persisted?.lastError).toBe("maximum retry attempts exceeded");
      expect(persisted?.failedAt).toBeInstanceOf(Date);
    } finally {
      await storage.query(
        `
          DELETE FROM dead_letter_events
          WHERE event_id = $1
            AND consumer_name = $2
        `,
        [event.eventId, consumerName],
      );

      await storage.disconnect();
    }
  });
});
