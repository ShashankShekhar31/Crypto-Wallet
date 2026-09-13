import { describe, expect, it } from "vitest";
import { DefaultReconciliationEngine } from "../reconciliation-engine.js";
import type { ReconciliationObservation } from "../reconciliation-types.js";

const scope = {
  assetId: "usdc",
  networkId: "ethereum",
  accountId: "exchange-asset-account-1",
};

function observation(
  source: ReconciliationObservation["source"],
  amount: string,
): ReconciliationObservation {
  return {
    source,
    scope,
    status: "available",
    amount,
    observedAt: "2026-09-12T00:00:00.000Z",
  };
}

describe("DefaultReconciliationEngine", () => {
  const engine = new DefaultReconciliationEngine();

  it("marks equal observations as matched", () => {
    const result = engine.compare(
      observation("ledger", "1000000"),
      observation("custody", "1000000"),
    );

    expect(result.status).toBe("matched");
    expect(result.difference).toBe("0");
  });

  it("calculates positive differences using integer arithmetic", () => {
    const result = engine.compare(
      observation("ledger", "1000000"),
      observation("blockchain", "1000500"),
    );

    expect(result.status).toBe("mismatched");
    expect(result.difference).toBe("500");
  });

  it("calculates negative differences using integer arithmetic", () => {
    const result = engine.compare(
      observation("ledger", "1000000"),
      observation("blockchain", "999500"),
    );

    expect(result.status).toBe("mismatched");
    expect(result.difference).toBe("-500");
  });

  it("rejects non-integer amounts", () => {
    expect(() =>
      engine.compare(observation("ledger", "1000.5"), observation("custody", "1000")),
    ).toThrow("Reconciliation amount must be a non-negative integer");
  });

  it("rejects observations from different scopes", () => {
    expect(() =>
      engine.compare(observation("ledger", "1000"), {
        ...observation("custody", "1000"),
        scope: {
          ...scope,
          assetId: "btc",
        },
      }),
    ).toThrow("Reconciliation observations must use the same scope");
  });
  it("marks the comparison unavailable when an observation is unavailable", () => {
    const result = engine.compare(
      {
        source: "ledger",
        scope,
        status: "available",
        amount: "1000000",
        observedAt: "2026-09-12T00:00:00.000Z",
      },
      {
        source: "custody",
        scope,
        status: "unavailable",
        amount: null,
        observedAt: "2026-09-12T00:00:01.000Z",
      },
    );

    expect(result.status).toBe("unavailable");
    expect(result.difference).toBeNull();
  });
});
