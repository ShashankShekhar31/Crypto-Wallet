import { describe, expect, it } from "vitest";
import type {
  ReconciliationComparison,
  ReconciliationObservation,
  ReconciliationScope,
} from "../reconciliation-types.js";

describe("reconciliation contract", () => {
  it("represents ledger and external observations for the same scope", () => {
    const scope: ReconciliationScope = {
      assetId: "usdc",
      networkId: "ethereum",
      accountId: "exchange-asset-account-1",
    };

    const ledgerObservation: ReconciliationObservation = {
      source: "ledger",
      scope,
      status: "available",
      amount: "1000000",
      observedAt: "2026-09-12T00:00:00.000Z",
      reference: "ledger-balance-1",
    };

    const custodyObservation: ReconciliationObservation = {
      source: "custody",
      scope,
      status: "available",
      amount: "1000000",
      observedAt: "2026-09-12T00:00:01.000Z",
      reference: "custody-balance-1",
    };

    const comparison: ReconciliationComparison = {
      scope,
      expected: ledgerObservation,
      actual: custodyObservation,
      difference: "0",
      status: "matched",
    };

    expect(comparison.expected.source).toBe("ledger");
    expect(comparison.actual.source).toBe("custody");
    expect(comparison.difference).toBe("0");
    expect(comparison.status).toBe("matched");
  });

  it("supports blockchain and fiat as external reconciliation sources", () => {
    const scope: ReconciliationScope = {
      assetId: "btc",
      networkId: "bitcoin",
    };

    const blockchainObservation: ReconciliationObservation = {
      source: "blockchain",
      scope,
      status: "available",
      amount: "25000000",
      observedAt: "2026-09-12T00:00:00.000Z",
    };

    const fiatObservation: ReconciliationObservation = {
      source: "fiat",
      scope: {
        assetId: "usd",
        accountId: "bank-account-1",
      },
      status: "available",
      amount: "500000",
      observedAt: "2026-09-12T00:00:00.000Z",
    };

    expect(blockchainObservation.source).toBe("blockchain");
    expect(fiatObservation.source).toBe("fiat");
  });

  it("represents mismatches without using floating-point amounts", () => {
    const scope: ReconciliationScope = {
      assetId: "usdc",
      networkId: "ethereum",
    };

    const expected: ReconciliationObservation = {
      source: "ledger",
      scope,
      status: "available",
      amount: "1000000",
      observedAt: "2026-09-12T00:00:00.000Z",
    };

    const actual: ReconciliationObservation = {
      source: "blockchain",
      scope,
      status: "available",
      amount: "999500",
      observedAt: "2026-09-12T00:00:00.000Z",
    };

    const comparison: ReconciliationComparison = {
      scope,
      expected,
      actual,
      difference: "-500",
      status: "mismatched",
    };

    expect(comparison.difference).toBe("-500");
    expect(comparison.status).toBe("mismatched");
  });
});