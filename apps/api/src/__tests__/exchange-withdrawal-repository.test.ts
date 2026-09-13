import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PostgresStorage } from "@crypto-wallet/storage";

import { ExchangeWithdrawalRepository } from "../exchange/exchange-withdrawal-repository.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for exchange withdrawal repository tests");
}

describe("ExchangeWithdrawalRepository", () => {
  async function createFixtures(storage: PostgresStorage) {
    const exchangeAccountId = randomUUID();
    const networkId = randomUUID();
    const assetId = randomUUID();
    const exchangeAssetAccountId = randomUUID();

    await storage.query(
      `
        INSERT INTO exchange_accounts (
          id,
          owner_type,
          owner_id,
          kind
        )
        VALUES ($1, 'customer', $2, 'customer')
      `,
      [exchangeAccountId, randomUUID()],
    );

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
        `withdrawal-test-${networkId}`,
        "Withdrawal Test Network",
        "withdrawal-test-chain",
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
      [assetId, networkId, `W${assetId.slice(0, 6)}`, "Withdrawal Test Asset", 18, "native"],
    );

    await storage.query(
      `
        INSERT INTO exchange_asset_accounts (
          id,
          exchange_account_id,
          asset_id,
          network_id
        )
        VALUES ($1, $2, $3, $4)
      `,
      [exchangeAssetAccountId, exchangeAccountId, assetId, networkId],
    );

    return {
      exchangeAccountId,
      networkId,
      assetId,
      exchangeAssetAccountId,
    };
  }

  async function cleanupFixtures(
    storage: PostgresStorage,
    exchangeAccountId: string,
    networkId: string,
    assetId: string,
  ) {
    await storage.query(
      `
        DELETE FROM exchange_withdrawals
        WHERE exchange_asset_account_id IN (
          SELECT id
          FROM exchange_asset_accounts
          WHERE exchange_account_id = $1
        )
      `,
      [exchangeAccountId],
    );

    await storage.query(
      `
        DELETE FROM exchange_asset_accounts
        WHERE exchange_account_id = $1
      `,
      [exchangeAccountId],
    );

    await storage.query(
      `
        DELETE FROM exchange_accounts
        WHERE id = $1
      `,
      [exchangeAccountId],
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

  it("creates and finds a withdrawal", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeWithdrawalRepository(storage);

    let fixtures:
      | {
          exchangeAccountId: string;
          networkId: string;
          assetId: string;
          exchangeAssetAccountId: string;
        }
      | undefined;

    try {
      await storage.connect();

      fixtures = await createFixtures(storage);

      const created = await repository.create({
        requestedBy: randomUUID(),
        exchangeAssetAccountId: fixtures.exchangeAssetAccountId,
        networkId: fixtures.networkId,
        destination: `destination-${randomUUID()}`,
        amount: "1250000",
        reference: `withdrawal-${randomUUID()}`,
      });

      expect(created).toMatchObject({
        exchangeAssetAccountId: fixtures.exchangeAssetAccountId,
        networkId: fixtures.networkId,
        amount: "1250000",
        status: "requested",
      });

      expect(created.createdAt).toBeInstanceOf(Date);

      const found = await repository.findById(created.id);

      expect(found).toEqual(created);
    } finally {
      if (fixtures) {
        await cleanupFixtures(
          storage,
          fixtures.exchangeAccountId,
          fixtures.networkId,
          fixtures.assetId,
        );
      }

      await storage.disconnect();
    }
  });

  it("finds a withdrawal by reference", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeWithdrawalRepository(storage);

    let fixtures:
      | {
          exchangeAccountId: string;
          networkId: string;
          assetId: string;
          exchangeAssetAccountId: string;
        }
      | undefined;

    try {
      await storage.connect();

      fixtures = await createFixtures(storage);

      const reference = `withdrawal-${randomUUID()}`;

      const created = await repository.create({
        requestedBy: randomUUID(),
        exchangeAssetAccountId: fixtures.exchangeAssetAccountId,
        networkId: fixtures.networkId,
        destination: `destination-${randomUUID()}`,
        amount: "2500000",
        reference,
      });

      const found = await repository.findByReference(reference);

      expect(found).toEqual(created);
    } finally {
      if (fixtures) {
        await cleanupFixtures(
          storage,
          fixtures.exchangeAccountId,
          fixtures.networkId,
          fixtures.assetId,
        );
      }

      await storage.disconnect();
    }
  });

  it("preserves an explicitly supplied withdrawal status", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeWithdrawalRepository(storage);

    let fixtures:
      | {
          exchangeAccountId: string;
          networkId: string;
          assetId: string;
          exchangeAssetAccountId: string;
        }
      | undefined;

    try {
      await storage.connect();

      fixtures = await createFixtures(storage);

      const requestedBy = randomUUID();
      const approvedBy = randomUUID();

      const created = await repository.create({
        requestedBy,
        approvedBy,
        exchangeAssetAccountId: fixtures.exchangeAssetAccountId,
        networkId: fixtures.networkId,
        destination: `destination-${randomUUID()}`,
        amount: "3000000",
        status: "approved",
        reference: `withdrawal-${randomUUID()}`,
      });

      expect(created.requestedBy).toBe(requestedBy);
      expect(created.approvedBy).toBe(approvedBy);
      expect(created.status).toBe("approved");

      const found = await repository.findById(created.id);

      expect(found?.status).toBe("approved");
    } finally {
      if (fixtures) {
        await cleanupFixtures(
          storage,
          fixtures.exchangeAccountId,
          fixtures.networkId,
          fixtures.assetId,
        );
      }

      await storage.disconnect();
    }
  });

  it("returns null for an unknown withdrawal", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeWithdrawalRepository(storage);

    try {
      await storage.connect();

      const found = await repository.findById(randomUUID());

      expect(found).toBeNull();
    } finally {
      await storage.disconnect();
    }
  });

  it("enforces unique withdrawal references", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeWithdrawalRepository(storage);

    let fixtures:
      | {
          exchangeAccountId: string;
          networkId: string;
          assetId: string;
          exchangeAssetAccountId: string;
        }
      | undefined;

    try {
      await storage.connect();

      fixtures = await createFixtures(storage);

      const reference = `duplicate-withdrawal-${randomUUID()}`;

      const input = {
        requestedBy: randomUUID(),
        exchangeAssetAccountId: fixtures.exchangeAssetAccountId,
        networkId: fixtures.networkId,
        destination: `destination-${randomUUID()}`,
        amount: "1000000",
        reference,
      };

      await repository.create(input);

      await expect(
        repository.create({
          ...input,
          destination: `destination-${randomUUID()}`,
        }),
      ).rejects.toThrow();
    } finally {
      if (fixtures) {
        await cleanupFixtures(
          storage,
          fixtures.exchangeAccountId,
          fixtures.networkId,
          fixtures.assetId,
        );
      }

      await storage.disconnect();
    }
  });
  it("rejects an approved withdrawal when requester and approver are the same actor", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeWithdrawalRepository(storage);

    let fixtures:
      | {
          exchangeAccountId: string;
          networkId: string;
          assetId: string;
          exchangeAssetAccountId: string;
        }
      | undefined;

    try {
      await storage.connect();

      fixtures = await createFixtures(storage);

      const actorId = randomUUID();

      await expect(
        repository.create({
          requestedBy: actorId,
          approvedBy: actorId,
          exchangeAssetAccountId: fixtures.exchangeAssetAccountId,
          networkId: fixtures.networkId,
          destination: `destination-${randomUUID()}`,
          amount: "4000000",
          status: "approved",
          reference: `withdrawal-${randomUUID()}`,
        }),
      ).rejects.toThrow();
    } finally {
      if (fixtures) {
        await cleanupFixtures(
          storage,
          fixtures.exchangeAccountId,
          fixtures.networkId,
          fixtures.assetId,
        );
      }

      await storage.disconnect();
    }
  });
});
