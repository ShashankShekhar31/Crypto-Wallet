import { randomUUID } from "node:crypto";

import { Kafka } from "kafkajs";
import { afterEach, describe, expect, it } from "vitest";

import type { ExchangeDepositCreatedEvent } from "@crypto-wallet/shared-types";

import { KafkaEventPublisher } from "../messaging/event-publisher.js";

const BROKER = "127.0.0.1:19092";
const TOPIC = "crypto-wallet.events";

describe("KafkaEventPublisher", () => {
  const resources: Array<{
    disconnect: () => Promise<void>;
  }> = [];

  afterEach(async () => {
    for (const resource of resources.splice(0)) {
      await resource.disconnect();
    }
  });

  it("publishes a versioned event to Redpanda", async () => {
    const eventId = randomUUID();

    const event: ExchangeDepositCreatedEvent = {
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
        transactionHash: "0x-test-transaction",
        amount: "1.25000000",
      },
    };

    const publisher = new KafkaEventPublisher({
      messaging: {
        brokers: [BROKER],
        clientId: `crypto-wallet-test-${randomUUID()}`,
        topic: TOPIC,
        consumerGroup: "crypto-wallet-test",
      },
    });

    await publisher.connect();
    resources.push(publisher);

    const kafka = new Kafka({
      clientId: `crypto-wallet-consumer-test-${randomUUID()}`,
      brokers: [BROKER],
    });

    const consumer = kafka.consumer({
      groupId: `crypto-wallet-test-${randomUUID()}`,
    });

    await consumer.connect();
    resources.push(consumer);

    await consumer.subscribe({
      topic: TOPIC,
      fromBeginning: true,
    });

    const received = new Promise<ExchangeDepositCreatedEvent>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timed out waiting for published event"));
      }, 10_000);

      void consumer.run({
        eachMessage: async ({ message }) => {
          if (!message.value) {
            return;
          }

          const receivedEvent = JSON.parse(message.value.toString()) as ExchangeDepositCreatedEvent;

          if (receivedEvent.eventId !== eventId) {
            return;
          }

          clearTimeout(timeout);
          resolve(receivedEvent);
        },
      });
    });

    await publisher.publish(event);

    const receivedEvent = await received;

    expect(receivedEvent).toEqual(event);
  }, 15_000);
});
