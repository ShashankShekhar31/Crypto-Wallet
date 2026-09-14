import { Kafka, type Consumer, type EachMessagePayload } from "kafkajs";

import type { AppConfig } from "@crypto-wallet/config";
import type { EventEnvelope } from "@crypto-wallet/shared-types";

import { DeadLetterRepository, InboxRepository, type Storage } from "@crypto-wallet/storage";

export interface EventConsumerHandler {
  (event: EventEnvelope, storage: Storage): Promise<void>;
}

export interface KafkaEventConsumerOptions {
  messaging: AppConfig["messaging"];
  storage: Storage;
  consumerName: string;
  handler: EventConsumerHandler;
  inboxRepository?: InboxRepository;
  deadLetterRepository?: DeadLetterRepository;
  maxAttempts?: number;
}

export class KafkaEventConsumer {
  private readonly consumer: Consumer;
  private readonly storage: Storage;
  private readonly consumerName: string;
  private readonly handler: EventConsumerHandler;
  private readonly inboxRepository: InboxRepository;
  private readonly deadLetterRepository: DeadLetterRepository;
  private readonly maxAttempts: number;

  constructor(options: KafkaEventConsumerOptions) {
    const kafka = new Kafka({
      clientId: options.messaging.clientId,
      brokers: options.messaging.brokers,
    });

    this.consumer = kafka.consumer({
      groupId: options.messaging.consumerGroup,
    });

    this.storage = options.storage;
    this.consumerName = options.consumerName;
    this.handler = options.handler;
    this.inboxRepository = options.inboxRepository ?? new InboxRepository();
    this.deadLetterRepository = options.deadLetterRepository ?? new DeadLetterRepository();
    this.maxAttempts = options.maxAttempts ?? 5;

    this.topic = options.messaging.topic;
  }

  private readonly topic: string;

  async connect(): Promise<void> {
    await this.consumer.connect();

    await this.consumer.subscribe({
      topic: this.topic,
      fromBeginning: false,
    });

    await this.consumer.run({
      eachMessage: async (payload) => {
        await this.handleMessage(payload);
      },
    });
  }

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
  }

  private async handleMessage({ message }: EachMessagePayload): Promise<void> {
    if (!message.value) {
      throw new Error("Kafka message has no value");
    }

    const event = parseEventEnvelope(message.value.toString());

    const recorded = await this.storage.transaction(async (transaction) =>
      this.inboxRepository.recordReceived(transaction, this.consumerName, event),
    );

    if (!recorded) {
      const existing = await this.inboxRepository.find(
        this.storage,
        event.eventId,
        this.consumerName,
      );

      if (existing?.processedAt) {
        return;
      }
    }

    const existing = await this.inboxRepository.find(
      this.storage,
      event.eventId,
      this.consumerName,
    );

    const attempts = existing?.attempts ?? 0;

    if (attempts >= this.maxAttempts) {
      await this.moveToDeadLetter(event, attempts, existing?.lastError);
      return;
    }

    try {
      await this.handler(event, this.storage);

      await this.storage.transaction(async (transaction) => {
        await this.inboxRepository.markProcessed(transaction, event.eventId, this.consumerName);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.inboxRepository.recordFailure(
        this.storage,
        event.eventId,
        this.consumerName,
        errorMessage,
      );

      const updated = await this.inboxRepository.find(
        this.storage,
        event.eventId,
        this.consumerName,
      );

      if ((updated?.attempts ?? 0) >= this.maxAttempts) {
        await this.moveToDeadLetter(event, updated?.attempts ?? this.maxAttempts, errorMessage);

        return;
      }

      throw error;
    }
  }

  private async moveToDeadLetter(
    event: EventEnvelope,
    attempts: number,
    error: string | null | undefined,
  ): Promise<void> {
    await this.storage.transaction(async (transaction) => {
      await this.deadLetterRepository.append(
        transaction,
        event,
        this.consumerName,
        attempts,
        error ?? "Maximum consumer attempts exceeded",
      );
    });
  }
}

function parseEventEnvelope(value: string): EventEnvelope {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Kafka message contains invalid JSON");
  }

  if (!isEventEnvelope(parsed)) {
    throw new Error("Kafka message does not contain a valid event envelope");
  }

  return parsed;
}

function isEventEnvelope(value: unknown): value is EventEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }

  const event = value as Record<string, unknown>;

  return (
    typeof event.eventId === "string" &&
    typeof event.eventType === "string" &&
    event.eventVersion === 1 &&
    typeof event.occurredAt === "string" &&
    typeof event.aggregateType === "string" &&
    typeof event.aggregateId === "string" &&
    typeof event.correlationId === "string" &&
    "payload" in event
  );
}
