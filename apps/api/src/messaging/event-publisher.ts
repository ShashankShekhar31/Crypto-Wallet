import { Kafka, type Producer } from "kafkajs";

import type { AppConfig } from "@crypto-wallet/config";
import type { EventEnvelope } from "@crypto-wallet/shared-types";

export interface EventPublisher {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish(event: EventEnvelope): Promise<void>;
}

export interface KafkaEventPublisherOptions {
  messaging: AppConfig["messaging"];
}

export class KafkaEventPublisher implements EventPublisher {
  private readonly producer: Producer;
  private readonly topic: string;

  constructor(options: KafkaEventPublisherOptions) {
    const kafka = new Kafka({
      clientId: options.messaging.clientId,
      brokers: options.messaging.brokers,
    });

    this.producer = kafka.producer();
    this.topic = options.messaging.topic;
  }

  async connect(): Promise<void> {
    await this.producer.connect();
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
  }

  async publish(event: EventEnvelope): Promise<void> {
    await this.producer.send({
      topic: this.topic,
      messages: [
        {
          key: event.aggregateId,
          value: JSON.stringify(event),
          headers: {
            eventType: event.eventType,
            eventVersion: String(event.eventVersion),
            correlationId: event.correlationId,
          },
        },
      ],
    });
  }
}
