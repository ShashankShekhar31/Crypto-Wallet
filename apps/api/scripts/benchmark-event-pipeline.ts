import { randomUUID } from "node:crypto";

import { Kafka } from "kafkajs";
import { PostgresStorage } from "@crypto-wallet/storage";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const broker = process.env.KAFKA_BROKERS ?? "127.0.0.1:19092";
const topic = process.env.KAFKA_TOPIC ?? "crypto-wallet.events";
const consumerName = "exchange-deposit-temporal";

const eventCount = Number(process.env.EVENT_COUNT ?? "20");
const timeoutMs = Number(process.env.EVENT_TIMEOUT_MS ?? "30000");
const pollIntervalMs = 100;

if (!Number.isInteger(eventCount) || eventCount <= 0) {
  throw new Error("EVENT_COUNT must be a positive integer");
}

const kafka = new Kafka({
  clientId: `crypto-wallet-performance-${randomUUID()}`,
  brokers: [broker],
});

const producer = kafka.producer();

const database = new PostgresStorage(databaseUrl);

interface InboxRow {
  event_id: string;
  received_at: Date;
  processed_at: Date | null;
  attempts: number;
  last_error: string | null;
}

function createEvent() {
  const depositId = randomUUID();

  return {
    eventId: randomUUID(),
    eventType: "exchange.deposit.created",
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    aggregateType: "exchange_deposit",
    aggregateId: depositId,
    correlationId: randomUUID(),
    payload: {
      depositId,
      exchangeAccountId: randomUUID(),
      assetAccountId: randomUUID(),
      transactionHash: `0x${randomUUID().replaceAll("-", "")}`,
      amount: "1.25000000",
    },
  };
}

async function waitForProcessed(eventIds: string[]): Promise<InboxRow[]> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await database.query<InboxRow>(
      `
        SELECT
          event_id,
          received_at,
          processed_at,
          attempts,
          last_error
        FROM consumer_inbox_events
        WHERE consumer_name = $1
          AND event_id = ANY($2::uuid[])
      `,
      [consumerName, eventIds],
    );

    const rows = result.rows;

    const failed = rows.find((row) => row.attempts > 0 && row.processed_at === null);

    if (failed) {
      throw new Error(
        `Consumer failure for event ${failed.event_id}: ${failed.last_error ?? "unknown error"}`,
      );
    }

    if (rows.length === eventIds.length && rows.every((row) => row.processed_at !== null)) {
      return rows;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Timed out waiting for ${eventIds.length} events to be processed`);
}

async function main(): Promise<void> {
  const events = Array.from({ length: eventCount }, createEvent);
  const eventIds = events.map((event) => event.eventId);

  await database.connect();
  await producer.connect();

  try {
    const publishStartedAt = performance.now();

    await producer.send({
      topic,
      messages: events.map((event) => ({
        key: event.aggregateId,
        value: JSON.stringify(event),
        headers: {
          eventType: event.eventType,
          eventVersion: String(event.eventVersion),
          correlationId: event.correlationId,
        },
      })),
    });

    const publishFinishedAt = performance.now();

    const rows = await waitForProcessed(eventIds);

    const completedAt = performance.now();

    const processingLatencies = rows
      .filter((row) => row.processed_at !== null)
      .map((row) => row.processed_at!.getTime() - row.received_at.getTime())
      .sort((a, b) => a - b);

    const totalLatencyMs = completedAt - publishStartedAt;
    const publishLatencyMs = publishFinishedAt - publishStartedAt;

    const percentile = (values: number[], percentileValue: number): number => {
      if (values.length === 0) {
        return 0;
      }

      const index = Math.ceil((percentileValue / 100) * values.length) - 1;

      return values[Math.max(0, Math.min(index, values.length - 1))];
    };

    console.log("");
    console.log("Event pipeline benchmark");
    console.log("------------------------");
    console.log(`Broker:              ${broker}`);
    console.log(`Topic:               ${topic}`);
    console.log(`Consumer:            ${consumerName}`);
    console.log(`Events published:    ${events.length}`);
    console.log(`Publish latency:     ${publishLatencyMs.toFixed(2)} ms`);
    console.log(`Total completion:    ${totalLatencyMs.toFixed(2)} ms`);
    console.log(`Consumer processing: p50=${percentile(processingLatencies, 50).toFixed(2)} ms`);
    console.log(`Consumer processing: p95=${percentile(processingLatencies, 95).toFixed(2)} ms`);
    console.log(`Consumer processing: p99=${percentile(processingLatencies, 99).toFixed(2)} ms`);
    console.log(
      `Processed successfully: ${rows.filter((row) => row.processed_at !== null).length}/${events.length}`,
    );
    console.log(`Retries:             ${rows.reduce((total, row) => total + row.attempts, 0)}`);
    console.log("");
  } finally {
    await producer.disconnect();
    await database.disconnect();
  }
}

await main();
