import { describe, expect, it } from "vitest";
import type { ReconciliationComparison, ReconciliationRepository } from "../index.js";

class InMemoryReconciliationRepository implements ReconciliationRepository {
  private readonly comparisons: ReconciliationComparison[] = [];

  async save(comparison: ReconciliationComparison): Promise<void> {
    this.comparisons.push(comparison);
  }

  async findLatest(
    assetId: string,
    networkId?: string,
    accountId?: string,
  ): Promise<ReconciliationComparison | null> {
    const matches = this.comparisons.filter((comparison) => {
      return (
        comparison.scope.assetId === assetId &&
        comparison.scope.networkId === networkId &&
        comparison.scope.accountId === accountId
      );
    });

    return matches.at(-1) ?? null;
  }
}

describe("ReconciliationRepository contract", () => {
  it("stores and retrieves the latest comparison for a scope", async () => {
    const repository = new InMemoryReconciliationRepository();

    const comparison: ReconciliationComparison = {
      scope: {
        assetId: "usdc",
        networkId: "ethereum",
        accountId: "exchange-asset-account-1",
      },
      expected: {
        source: "ledger",
        scope: {
          assetId: "usdc",
          networkId: "ethereum",
          accountId: "exchange-asset-account-1",
        },
        status: "available",
        amount: "1000000",
        observedAt: "2026-09-12T00:00:00.000Z",
      },
      actual: {
        source: "custody",
        scope: {
          assetId: "usdc",
          networkId: "ethereum",
          accountId: "exchange-asset-account-1",
        },
        status: "available",
        amount: "1000000",
        observedAt: "2026-09-12T00:00:01.000Z",
      },
      difference: "0",
      status: "matched",
    };

    await repository.save(comparison);

    await expect(
      repository.findLatest("usdc", "ethereum", "exchange-asset-account-1"),
    ).resolves.toEqual(comparison);
  });

  it("returns null when no comparison exists", async () => {
    const repository = new InMemoryReconciliationRepository();

    await expect(repository.findLatest("btc", "bitcoin", "missing-account")).resolves.toBeNull();
  });
});
