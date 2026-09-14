import { randomUUID } from "node:crypto";

import { Kafka } from "kafkajs";
import { afterEach, describe, expect, it } from "vitest";

import type { EventEnvelope, ExchangeDepositCreatedEvent } from "@crypto-wallet/shared-types";
import { DeadLetterRepository, InboxRepository, PostgresStorage } from "@crypto-wallet/storage";

import { KafkaEventConsumer } from "../messaging/event-consumer.js";

const databaseUrl = process.env.DATABASE_URL;
const broker = process.env.KAFKA_BROKERS ?? "127.0.0.1:19092";
const topic = process.env.KAFKA_TOPIC ?? "crypto-wallet.events";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for event consumer tests");
}

const resources: Array<{
  consumer?: KafkaEventConsumer;
  storage?: PostgresStorage;
}> = [];

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
      amount: "2.50000000",
    },
  };
}

async function publishEvent(event: EventEnvelope): Promise<void> {
  const kafka = new Kafka({
    clientId: `crypto-wallet-consumer-test-publisher-${randomUUID()}`,
    brokers: [broker],
  });

  const producer = kafka.producer();

  await producer.connect();

  try {
    await producer.send({
      topic,
      messages: [
        {
          key: event.aggregateId,
          value: JSON.stringify(event),
        },
      ],
    });
  } finally {
    await producer.disconnect();
  }
}

async function waitFor(
  condition: () => Promise<boolean>,
  timeoutMs = 10_000,
  intervalMs = 100,
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await condition()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Timed out waiting for condition");
}

afterEach(async () => {
  for (const resource of resources.splice(0)) {
    await resource.consumer?.disconnect();
    await resource.storage?.disconnect();
  }
});

describe("KafkaEventConsumer", () => {
  it("receives an event and marks it processed in the inbox", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const inboxRepository = new InboxRepository();

    const consumerName = `exchange-deposit-test-${randomUUID()}`;
    const consumerGroup = `crypto-wallet-consumer-test-${randomUUID()}`;
    const event = createEvent();

    await storage.connect();

    let handledEvent: EventEnvelope | undefined;

    const consumer = new KafkaEventConsumer({
      messaging: {
        brokers: [broker],
        topic,
        clientId: `crypto-wallet-consumer-${randomUUID()}`,
        consumerGroup,
      },
      storage,
      consumerName,
      handler: async (receivedEvent) => {
        handledEvent = receivedEvent;
      },
      inboxRepository,
    });

    resources.push({ consumer, storage });

    await consumer.connect();

    await publishEvent(event);

    await waitFor(async () => {
      const persisted = await inboxRepository.find(storage, event.eventId, consumerName);

      return persisted?.processedAt instanceof Date;
    });

    expect(handledEvent).toEqual(event);

    const persisted = await inboxRepository.find(storage, event.eventId, consumerName);

    expect(persisted).not.toBeNull();
    expect(persisted?.processedAt).toBeInstanceOf(Date);
    expect(persisted?.attempts).toBe(0);
    expect(persisted?.lastError).toBeNull();

    await storage.query(
      `
        DELETE FROM consumer_inbox_events
        WHERE event_id = $1
          AND consumer_name = $2
      `,
      [event.eventId, consumerName],
    );
  });
  it("does not process the same event twice for the same consumer", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const inboxRepository = new InboxRepository();

    const consumerName = `exchange-deposit-duplicate-test-${randomUUID()}`;
    const consumerGroup = `crypto-wallet-consumer-duplicate-test-${randomUUID()}`;
    const event = createEvent();

    await storage.connect();

    let handledCount = 0;

    const consumer = new KafkaEventConsumer({
      messaging: {
        brokers: [broker],
        topic,
        clientId: `crypto-wallet-consumer-${randomUUID()}`,
        consumerGroup,
      },
      storage,
      consumerName,
      handler: async () => {
        handledCount += 1;
      },
      inboxRepository,
    });

    resources.push({ consumer, storage });

    await consumer.connect();

    await publishEvent(event);
    await publishEvent(event);

    await waitFor(async () => {
      const persisted = await inboxRepository.find(storage, event.eventId, consumerName);

      return persisted?.processedAt instanceof Date;
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(handledCount).toBe(1);

    const persisted = await inboxRepository.find(storage, event.eventId, consumerName);

    expect(persisted).not.toBeNull();
    expect(persisted?.processedAt).toBeInstanceOf(Date);
    expect(persisted?.attempts).toBe(0);

    await storage.query(
      `
        DELETE FROM consumer_inbox_events
        WHERE event_id = $1
          AND consumer_name = $2
      `,
      [event.eventId, consumerName],
    );
  });
  it("moves an event to the dead-letter store after maximum attempts", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const inboxRepository = new InboxRepository();
    const deadLetterRepository = new DeadLetterRepository();

    const consumerName = `exchange-deposit-dlq-test-${randomUUID()}`;
    const consumerGroup = `crypto-wallet-consumer-dlq-test-${randomUUID()}`;
    const event = createEvent();

    await storage.connect();

    let handledCount = 0;

    const consumer = new KafkaEventConsumer({
      messaging: {
        brokers: [broker],
        topic,
        clientId: `crypto-wallet-consumer-${randomUUID()}`,
        consumerGroup,
      },
      storage,
      consumerName,
      handler: async () => {
        handledCount += 1;

        throw new Error("intentional consumer failure");
      },
      inboxRepository,
      deadLetterRepository,
      maxAttempts: 1,
    });

    resources.push({ consumer, storage });

    await consumer.connect();

    await publishEvent(event);

    await waitFor(async () => {
      const deadLetter = await deadLetterRepository.find(storage, event.eventId, consumerName);

      return deadLetter !== null;
    });

    expect(handledCount).toBe(1);

    const inboxEvent = await inboxRepository.find(storage, event.eventId, consumerName);

    expect(inboxEvent).not.toBeNull();
    expect(inboxEvent?.attempts).toBe(1);
    expect(inboxEvent?.lastError).toBe("intentional consumer failure");

    const deadLetter = await deadLetterRepository.find(storage, event.eventId, consumerName);

    expect(deadLetter).not.toBeNull();
    expect(deadLetter?.eventId).toBe(event.eventId);
    expect(deadLetter?.consumerName).toBe(consumerName);
    expect(deadLetter?.eventType).toBe(event.eventType);
    expect(deadLetter?.eventVersion).toBe(event.eventVersion);
    expect(deadLetter?.payload).toEqual(event.payload);
    expect(deadLetter?.attempts).toBe(1);
    expect(deadLetter?.lastError).toBe("intentional consumer failure");

    await storage.query(
      `
        DELETE FROM dead_letter_events
        WHERE event_id = $1
          AND consumer_name = $2
      `,
      [event.eventId, consumerName],
    );

    await storage.query(
      `
        DELETE FROM consumer_inbox_events
        WHERE event_id = $1
          AND consumer_name = $2
      `,
      [event.eventId, consumerName],
    );
  });
});
