import { describe, expect, it } from "vitest";

import type { Transaction } from "@crypto-wallet/shared-types";

import { DefaultTransactionEngine } from "../transaction-engine.js";

describe("DefaultTransactionEngine", () => {
  const transaction: Transaction = {
    id: "tx-1",
    chain: "bitcoin",
    status: "draft",
    assetId: "btc",
    amount: "100000",
    createdAt: "2026-09-03T00:00:00.000Z",
  };

  it("creates and stores a transaction", () => {
    const engine = new DefaultTransactionEngine();

    const created = engine.create(transaction);

    expect(created).toEqual(transaction);
    expect(engine.getById("tx-1")).toEqual(transaction);
  });

  it("returns null for an unknown transaction", () => {
    const engine = new DefaultTransactionEngine();

    expect(engine.getById("unknown")).toBeNull();
  });

  it("rejects duplicate transaction ids", () => {
    const engine = new DefaultTransactionEngine();

    engine.create(transaction);

    expect(() => engine.create(transaction)).toThrow("Transaction already exists: tx-1");
  });

  it("transitions a stored transaction", () => {
    const engine = new DefaultTransactionEngine();

    engine.create(transaction);

    const updated = engine.transition("tx-1", "signed");

    expect(updated).toEqual({
      ...transaction,
      status: "signed",
    });

    expect(engine.getById("tx-1")).toEqual(updated);
  });

  it("rejects transitions for an unknown transaction", () => {
    const engine = new DefaultTransactionEngine();

    expect(() => engine.transition("unknown", "signed")).toThrow("Transaction not found: unknown");
  });

  it("rejects invalid lifecycle transitions", () => {
    const engine = new DefaultTransactionEngine();

    engine.create(transaction);

    expect(() => engine.transition("tx-1", "confirmed")).toThrow(
      "Invalid transaction transition: draft -> confirmed",
    );

    expect(engine.getById("tx-1")).toEqual(transaction);
  });

  it("does not expose mutable transaction state", () => {
    const engine = new DefaultTransactionEngine();

    engine.create(transaction);

    const stored = engine.getById("tx-1");

    expect(stored).not.toBe(transaction);

    expect(stored).toEqual(transaction);
  });

  it("returns a snapshot when a transaction is transitioned", () => {
    const engine = new DefaultTransactionEngine();

    engine.create(transaction);

    const signed = engine.transition("tx-1", "signed");
    const fetched = engine.getById("tx-1");

    expect(signed).not.toBe(fetched);
    expect(fetched).toEqual({
      ...transaction,
      status: "signed",
    });
  });

  it("returns the same transaction for a repeated idempotency key", () => {
    const engine = new DefaultTransactionEngine();

    const first = engine.createIdempotent("request-1", transaction);
    const second = engine.createIdempotent("request-1", transaction);

    expect(first).toEqual(transaction);
    expect(second).toEqual(transaction);
    expect(second).not.toBe(first);

    expect(engine.getById("tx-1")).toEqual(transaction);
  });

  it("does not create a second transaction for a repeated idempotency key", () => {
    const engine = new DefaultTransactionEngine();

    engine.createIdempotent("request-1", transaction);

    const secondTransaction: Transaction = {
      ...transaction,
      id: "tx-2",
    };

    const result = engine.createIdempotent("request-1", secondTransaction);

    expect(result).toEqual(transaction);
    expect(engine.getById("tx-1")).toEqual(transaction);
    expect(engine.getById("tx-2")).toBeNull();
  });

  it("rejects an idempotency key reused for a different transaction", () => {
    const engine = new DefaultTransactionEngine();

    engine.createIdempotent("request-1", transaction);

    const differentTransaction: Transaction = {
      ...transaction,
      id: "tx-2",
      amount: "200000",
    };

    expect(() => engine.createIdempotent("request-1", differentTransaction)).toThrow(
      "Idempotency key already used: request-1",
    );
  });

  it("allows different idempotency keys for different transactions", () => {
    const engine = new DefaultTransactionEngine();

    const secondTransaction: Transaction = {
      ...transaction,
      id: "tx-2",
    };

    const first = engine.createIdempotent("request-1", transaction);
    const second = engine.createIdempotent("request-2", secondTransaction);

    expect(first).toEqual(transaction);
    expect(second).toEqual(secondTransaction);
    expect(engine.getById("tx-1")).toEqual(transaction);
    expect(engine.getById("tx-2")).toEqual(secondTransaction);
  });

  it("returns the current transaction state for a repeated idempotency key", () => {
    const engine = new DefaultTransactionEngine();

    engine.createIdempotent("request-1", transaction);

    engine.transition("tx-1", "signed");
    engine.transition("tx-1", "submitted");

    const retry = engine.createIdempotent("request-1", transaction);

    expect(retry).toEqual({
      ...transaction,
      status: "submitted",
    });

    expect(retry).not.toBe(transaction);
  });
});
