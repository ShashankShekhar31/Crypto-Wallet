import { describe, expect, it } from "vitest";

import type { Transaction } from "@crypto-wallet/shared-types";

import { createTransactionState, updateTransactionStatus } from "../transaction-state.js";

describe("transaction state", () => {
  const transaction: Transaction = {
    id: "tx-1",
    chain: "bitcoin",
    status: "draft",
    assetId: "btc",
    amount: "100000",
    createdAt: "2026-09-03T00:00:00.000Z",
  };

  it("creates transaction state from a transaction", () => {
    expect(createTransactionState(transaction)).toEqual(transaction);
  });

  it("updates a transaction to a valid next status", () => {
    const state = createTransactionState(transaction);

    const updated = updateTransactionStatus(state, "signed");

    expect(updated).toEqual({
      ...transaction,
      status: "signed",
    });
  });

  it("does not mutate the original transaction", () => {
    const state = createTransactionState(transaction);

    updateTransactionStatus(state, "signed");

    expect(state).toEqual(transaction);
  });

  it("rejects an invalid status transition", () => {
    const state = createTransactionState(transaction);

    expect(() => updateTransactionStatus(state, "confirmed")).toThrow(
      "Invalid transaction transition: draft -> confirmed",
    );
  });

  it("preserves all transaction fields during a transition", () => {
    const state = createTransactionState(transaction);

    const updated = updateTransactionStatus(state, "signed");

    expect(updated.id).toBe("tx-1");
    expect(updated.chain).toBe("bitcoin");
    expect(updated.assetId).toBe("btc");
    expect(updated.amount).toBe("100000");
    expect(updated.createdAt).toBe("2026-09-03T00:00:00.000Z");
    expect(updated.status).toBe("signed");
  });

  it("supports the complete valid lifecycle", () => {
    let state = createTransactionState(transaction);

    state = updateTransactionStatus(state, "signed");
    state = updateTransactionStatus(state, "submitted");
    state = updateTransactionStatus(state, "pending");
    state = updateTransactionStatus(state, "confirmed");

    expect(state.status).toBe("confirmed");
  });

  it("supports pending to failed", () => {
    let state = createTransactionState(transaction);

    state = updateTransactionStatus(state, "signed");
    state = updateTransactionStatus(state, "submitted");
    state = updateTransactionStatus(state, "pending");
    state = updateTransactionStatus(state, "failed");

    expect(state.status).toBe("failed");
  });
});
