import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PostgresStorage } from "@crypto-wallet/storage";

import { PostgresReconciliationRepository } from "../reconciliation/reconciliation-repository.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for reconciliation repository tests");
}

describe("PostgresReconciliationRepository", () => {
  async function createFixtures(storage: PostgresStorage) {
    const assetId = randomUUID();
    const networkId = randomUUID();
    const accountId = randomUUID();

    await storage.query(
      `
      INSERT INTO networks (
        id,
        key,
        name,
        chain,
        environment
      )
      VALUES ($1, $2, $3, $4, $5)
    `,
      [
        networkId,
        `reconciliation-test-${networkId.slice(0, 6)}`,
        "Reconciliation Test Network",
        "test",
        "test",
      ],
    );

    await storage.query(
      `
      INSERT INTO assets (
        id,
        network_id,
        symbol,
        name,
        decimals,
        asset_type
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
      [assetId, networkId, `REC${assetId.slice(0, 4)}`, "Reconciliation Test Asset", 18, "native"],
    );

    return {
      assetId,
      networkId,
      accountId,
    };
  }

  async function cleanupFixtures(storage: PostgresStorage, assetId: string, networkId: string) {
    await storage.query(
      `
      DELETE FROM reconciliation_comparisons
      WHERE asset_id = $1
    `,
      [assetId],
    );

    await storage.query(
      `
      DELETE FROM assets
      WHERE id = $1
    `,
      [assetId],
    );

    await storage.query(
      `
      DELETE FROM networks
      WHERE id = $1
    `,
      [networkId],
    );
  }

  it("saves and retrieves the latest reconciliation comparison", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new PostgresReconciliationRepository(storage);

    await storage.connect();

    const { assetId, networkId, accountId } = await createFixtures(storage);

    const comparison = {
      scope: {
        assetId,
        networkId,
        accountId,
      },
      expected: {
        source: "ledger" as const,
        scope: {
          assetId,
          networkId,
          accountId,
        },
        status: "available" as const,
        amount: "1000000",
        observedAt: "2026-09-12T00:00:00.000Z",
        reference: "ledger-test-reference",
      },
      actual: {
        source: "custody" as const,
        scope: {
          assetId,
          networkId,
          accountId,
        },
        status: "available" as const,
        amount: "999500",
        observedAt: "2026-09-12T00:00:01.000Z",
        reference: "custody-test-reference",
      },
      difference: "-500",
      status: "mismatched" as const,
    };

    try {
      await repository.save(comparison);

      const result = await repository.findLatest(assetId, networkId, accountId);

      expect(result).not.toBeNull();
      expect(result).toEqual(comparison);
    } finally {
      await cleanupFixtures(storage, assetId, networkId);
      await storage.disconnect();
    }
  });

  it("returns null for an unknown reconciliation scope", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new PostgresReconciliationRepository(storage);

    await storage.connect();

    try {
      const result = await repository.findLatest(randomUUID(), randomUUID(), randomUUID());

      expect(result).toBeNull();
    } finally {
      await storage.disconnect();
    }
  });
  it("persists an unavailable observation without inventing a zero amount", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new PostgresReconciliationRepository(storage);

    await storage.connect();

    const { assetId, networkId, accountId } = await createFixtures(storage);

    const comparison = {
      scope: {
        assetId,
        networkId,
        accountId,
      },
      expected: {
        source: "ledger" as const,
        scope: {
          assetId,
          networkId,
          accountId,
        },
        status: "available" as const,
        amount: "1000000",
        observedAt: "2026-09-12T00:00:00.000Z",
      },
      actual: {
        source: "custody" as const,
        scope: {
          assetId,
          networkId,
          accountId,
        },
        status: "unavailable" as const,
        amount: null,
        observedAt: "2026-09-12T00:00:01.000Z",
      },
      difference: null,
      status: "unavailable" as const,
    };

    try {
      await repository.save(comparison);

      const result = await repository.findLatest(assetId, networkId, accountId);

      expect(result).toEqual(comparison);
      expect(result?.actual.status).toBe("unavailable");
      expect(result?.actual.amount).toBeNull();
      expect(result?.difference).toBeNull();
    } finally {
      await cleanupFixtures(storage, assetId, networkId);
      await storage.disconnect();
    }
  });
});
