import { describe, expect, it, vi } from "vitest";

import type { EventEnvelope, ExchangeDepositCreatedEvent } from "@crypto-wallet/shared-types";

import { createExchangeDepositEventHandler } from "../messaging/exchange-deposit-handler.js";

function createTemporalClientMock() {
  return {
    workflow: {
      start: vi.fn().mockResolvedValue({
        workflowId: "exchange-deposit-deposit-123",
        firstExecutionRunId: "run-123",
      }),
    },
  };
}

function createDepositEvent(): ExchangeDepositCreatedEvent {
  return {
    eventId: "event-123",
    eventType: "exchange.deposit.created",
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    aggregateType: "exchange_deposit",
    aggregateId: "deposit-123",
    correlationId: "correlation-123",
    payload: {
      depositId: "deposit-123",
      exchangeAccountId: "exchange-account-123",
      assetAccountId: "asset-account-123",
      transactionHash: "0x123",
      amount: "125",
    },
  };
}

describe("createExchangeDepositEventHandler", () => {
  it("starts the Temporal workflow for exchange.deposit.created", async () => {
    const temporalClient = createTemporalClientMock();

    const handler = createExchangeDepositEventHandler({
      temporalClient: temporalClient as never,
    });

    await handler(createDepositEvent(), {} as never);

    expect(temporalClient.workflow.start).toHaveBeenCalledOnce();
    expect(temporalClient.workflow.start).toHaveBeenCalledWith(
      "processExchangeDepositWorkflow",
      expect.objectContaining({
        taskQueue: "crypto-wallet.workflows",
        workflowId: "exchange-deposit-deposit-123",
        args: [
          expect.objectContaining({
            depositId: "deposit-123",
            exchangeAccountId: "exchange-account-123",
            assetAccountId: "asset-account-123",
            transactionHash: "0x123",
            amount: "125",
          }),
        ],
      }),
    );
  });

  it("ignores unrelated event types", async () => {
    const temporalClient = createTemporalClientMock();

    const handler = createExchangeDepositEventHandler({
      temporalClient: temporalClient as never,
    });

    const event = createDepositEvent();

    await handler(
      {
        ...event,
        eventType: "some.other.event",
      },
      {} as never,
    );

    expect(temporalClient.workflow.start).not.toHaveBeenCalled();
  });

  it("rejects unsupported event versions", async () => {
    const temporalClient = createTemporalClientMock();

    const handler = createExchangeDepositEventHandler({
      temporalClient: temporalClient as never,
    });

    const event = createDepositEvent();

    await expect(
      handler(
        {
          ...event,
          eventVersion: 2 as never,
        },
        {} as never,
      ),
    ).rejects.toThrow("Unsupported exchange.deposit.created event version: 2");

    expect(temporalClient.workflow.start).not.toHaveBeenCalled();
  });

  it("rejects an event without a deposit ID", async () => {
    const temporalClient = createTemporalClientMock();

    const handler = createExchangeDepositEventHandler({
      temporalClient: temporalClient as never,
    });

    const event = createDepositEvent();

    await expect(
      handler(
        {
          ...event,
          payload: {
            ...event.payload,
            depositId: "",
          },
        },
        {} as never,
      ),
    ).rejects.toThrow("exchange.deposit.created event is missing depositId");

    expect(temporalClient.workflow.start).not.toHaveBeenCalled();
  });
});
