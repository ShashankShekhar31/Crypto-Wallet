export type EventVersion = 1;

export interface EventEnvelope<TPayload = unknown> {
  eventId: string;
  eventType: string;
  eventVersion: EventVersion;
  occurredAt: string;
  aggregateType: string;
  aggregateId: string;
  correlationId: string;
  payload: TPayload;
}

export interface ExchangeDepositCreatedV1 {
  depositId: string;
  exchangeAccountId: string;
  assetAccountId: string;
  transactionHash: string;
  amount: string;
}

export type ExchangeDepositCreatedEvent = EventEnvelope<ExchangeDepositCreatedV1> & {
  eventType: "exchange.deposit.created";
};
