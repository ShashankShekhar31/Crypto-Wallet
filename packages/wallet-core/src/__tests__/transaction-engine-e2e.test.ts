import { describe, expect, it } from "vitest";

import { DefaultTransactionEngine } from "../transaction-engine.js";

describe("transaction engine end-to-end", () => {
  function createTransaction(
    overrides: Partial<{
      id: string;
      chain: "evm" | "solana" | "bitcoin";
      status: "draft" | "signed" | "submitted" | "pending" | "confirmed" | "failed";
      assetId: string;
      amount: string;
    }> = {},
  ) {
    return {
      id: overrides.id ?? "tx-day28-001",
      chain: overrides.chain ?? "bitcoin",
      status: overrides.status ?? "draft",
      assetId: overrides.assetId ?? "btc",
      amount: overrides.amount ?? "100000",
      createdAt: new Date().toISOString(),
    };
  }

  it("creates and tracks a transaction through the lifecycle", () => {
    const engine = new DefaultTransactionEngine();

    const created = engine.create(createTransaction());

    expect(created.status).toBe("draft");
    expect(engine.getById(created.id)).toEqual(created);

    const signed = engine.transition(created.id, "signed");
    expect(signed.status).toBe("signed");

    const submitted = engine.transition(created.id, "submitted");
    expect(submitted.status).toBe("submitted");

    const pending = engine.transition(created.id, "pending");
    expect(pending.status).toBe("pending");

    const confirmed = engine.transition(created.id, "confirmed");
    expect(confirmed.status).toBe("confirmed");

    expect(engine.getById(created.id)?.status).toBe("confirmed");
  });

  it("handles duplicate requests idempotently", () => {
    const engine = new DefaultTransactionEngine();

    const transaction = createTransaction({
      id: "tx-day28-idempotent",
    });

    const first = engine.createIdempotent("request-001", transaction);
    const second = engine.createIdempotent("request-001", transaction);

    expect(second).toEqual(first);
    expect(second.id).toBe(first.id);
  });

  it("rejects reuse of an idempotency key for a different transaction", () => {
    const engine = new DefaultTransactionEngine();

    engine.createIdempotent(
      "request-002",
      createTransaction({
        id: "tx-day28-original",
        amount: "100000",
      }),
    );

    expect(() =>
      engine.createIdempotent(
        "request-002",
        createTransaction({
          id: "tx-day28-different",
          amount: "200000",
        }),
      ),
    ).toThrow("Idempotency key already used: request-002");
  });

  it("rejects invalid lifecycle transitions", () => {
    const engine = new DefaultTransactionEngine();

    const transaction = engine.create(createTransaction());

    expect(() => engine.transition(transaction.id, "confirmed")).toThrow(
      "Invalid transaction transition: draft -> confirmed",
    );

    expect(() => engine.transition("missing-transaction", "signed")).toThrow(
      "Transaction not found: missing-transaction",
    );
  });

  it("prevents changes after terminal confirmation", () => {
    const engine = new DefaultTransactionEngine();

    const transaction = engine.create(createTransaction());

    engine.transition(transaction.id, "signed");
    engine.transition(transaction.id, "submitted");
    engine.transition(transaction.id, "pending");

    const confirmed = engine.transition(transaction.id, "confirmed");

    expect(() => engine.transition(confirmed.id, "pending")).toThrow(
      "Invalid transaction transition: confirmed -> pending",
    );

    expect(engine.getById(confirmed.id)?.status).toBe("confirmed");
  });
});
