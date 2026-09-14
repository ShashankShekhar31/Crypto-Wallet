import { randomUUID } from "node:crypto";
import type { EventEnvelope } from "@crypto-wallet/shared-types";

import { OutboxRepository, type OutboxEventRecord, type Storage } from "@crypto-wallet/storage";

import type { EventPublisher } from "./event-publisher.js";

export interface OutboxPublisherOptions {
  repository?: OutboxRepository;
  batchSize?: number;
  retryBaseDelayMs?: number;
}

export class OutboxPublisher {
  private readonly repository: OutboxRepository;
  private readonly batchSize: number;
  private readonly retryBaseDelayMs: number;

  constructor(
    private readonly storage: Storage,
    private readonly publisher: EventPublisher,
    options: OutboxPublisherOptions = {},
  ) {
    this.repository = options.repository ?? new OutboxRepository();
    this.batchSize = options.batchSize ?? 100;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 1_000;
  }

  async publishPending(): Promise<{
    published: number;
    failed: number;
  }> {
    const processingToken = randomUUID();

    const events = await this.repository.claimUnpublished(
      this.storage,
      processingToken,
      this.batchSize,
    );

    let published = 0;
    let failed = 0;

    for (const event of events) {
      try {
        await this.publisher.publish(toEventEnvelope(event));

        await this.repository.markPublished(this.storage, event.eventId, processingToken);

        published += 1;
      } catch (error) {
        failed += 1;

        await this.repository.recordFailure(
          this.storage,
          event.eventId,
          processingToken,
          error instanceof Error ? error.message : String(error),
          calculateRetryAt(event.attempts, this.retryBaseDelayMs),
        );
      }
    }

    return { published, failed };
  }
}

function toEventEnvelope(event: OutboxEventRecord): EventEnvelope {
  return {
    eventId: event.eventId,
    eventType: event.eventType,
    eventVersion: event.eventVersion as EventEnvelope["eventVersion"],
    occurredAt: event.occurredAt.toISOString(),
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    correlationId: event.correlationId,
    payload: event.payload,
  };
}

function calculateRetryAt(attempts: number, baseDelayMs: number): Date {
  const nextAttempt = attempts + 1;
  const delayMs = baseDelayMs * 2 ** Math.min(nextAttempt - 1, 10);

  return new Date(Date.now() + delayMs);
}
