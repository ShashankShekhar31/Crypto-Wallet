import type { EventEnvelope, ExchangeDepositCreatedEvent } from "@crypto-wallet/shared-types";

import type { Storage } from "@crypto-wallet/storage";

import { startExchangeDepositWorkflow, type TemporalWorkflowClient } from "../temporal/client.js";

export interface ExchangeDepositEventHandlerOptions {
  temporalClient: TemporalWorkflowClient;
}

export function createExchangeDepositEventHandler(options: ExchangeDepositEventHandlerOptions) {
  return async (event: EventEnvelope, _storage: Storage): Promise<void> => {
    if (event.eventType !== "exchange.deposit.created") {
      return;
    }

    if (event.eventVersion !== 1) {
      throw new Error(`Unsupported exchange.deposit.created event version: ${event.eventVersion}`);
    }

    const depositEvent = event as ExchangeDepositCreatedEvent;
    const { depositId } = depositEvent.payload;

    if (!depositId) {
      throw new Error("exchange.deposit.created event is missing depositId");
    }

    await startExchangeDepositWorkflow(
      options.temporalClient,
      `exchange-deposit-${depositId}`,
      depositEvent.payload,
    );
  };
}
