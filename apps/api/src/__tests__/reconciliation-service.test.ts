import { describe, expect, it } from "vitest";

import type {
  ReconciliationComparison,
  ReconciliationRepository,
} from "@crypto-wallet/ledger-core";

import { ReconciliationService } from "../reconciliation/reconciliation-service.js";

class InMemoryReconciliationRepository
  implements ReconciliationRepository
{
  private latest: ReconciliationComparison | null = null;

  async save(comparison: ReconciliationComparison): Promise<void> {
    this.latest = comparison;
  }

  async findLatest(
    assetId: string,
    networkId?: string,
    accountId?: string,
  ): Promise<ReconciliationComparison | null> {
    if (this.latest === null) {
      return null;
    }

    const scope = this.latest.scope;

    if (
      scope.assetId !== assetId ||
      scope.networkId !== networkId ||
      scope.accountId !== accountId
    ) {
      return null;
    }

    return this.latest;
  }
}

describe("ReconciliationService", () => {
  it("compares observations and persists the result", async () => {
    const repository = new InMemoryReconciliationRepository();
    const service = new ReconciliationService(repository);

    const scope = {
      assetId: "usdc",
      networkId: "ethereum",
      accountId: "exchange-asset-account-1",
    };

    const expected = {
      source: "ledger" as const,
      scope,
      status: "available" as const,
      amount: "1000000",
      observedAt: "2026-09-12T00:00:00.000Z",
    };

    const actual = {
      source: "custody" as const,
      scope,
      status: "available" as const,
      amount: "999500",
      observedAt: "2026-09-12T00:00:01.000Z",
    };

    const result = await service.reconcile(expected, actual);

    expect(result.status).toBe("mismatched");
    expect(result.difference).toBe("-500");

    await expect(
      service.findLatest(
        scope.assetId,
        scope.networkId,
        scope.accountId,
      ),
    ).resolves.toEqual(result);
  });

  it("returns null when no reconciliation exists", async () => {
    const repository = new InMemoryReconciliationRepository();
    const service = new ReconciliationService(repository);

    await expect(
      service.findLatest(
        "missing-asset",
        "missing-network",
        "missing-account",
      ),
    ).resolves.toBeNull();
  });
});