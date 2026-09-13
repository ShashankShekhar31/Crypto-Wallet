import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PostgresStorage } from "@crypto-wallet/storage";

import {
  ExchangeDepositRepository,
} from "../exchange/exchange-deposit-repository.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required for exchange deposit repository tests",
  );
}

describe("ExchangeDepositRepository", () => {
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
        `deposit-test-${networkId}`,
        "Deposit Test Network",
        "deposit-test-chain",
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
      [
        assetId,
        networkId,
        `D${assetId.slice(0, 6)}`,
        "Deposit Test Asset",
        18,
        "native",
      ],
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
      [
        exchangeAssetAccountId,
        exchangeAccountId,
        assetId,
        networkId,
      ],
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
        DELETE FROM exchange_deposits
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

  it("creates and finds a deposit", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeDepositRepository(storage);

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
        exchangeAssetAccountId: fixtures.exchangeAssetAccountId,
        networkId: fixtures.networkId,
        transactionHash: `tx-${randomUUID()}`,
        amount: "1250000",
        reference: `deposit-${randomUUID()}`,
      });

      expect(created).toMatchObject({
        exchangeAssetAccountId: fixtures.exchangeAssetAccountId,
        networkId: fixtures.networkId,
        amount: "1250000",
        status: "detected",
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

  it("finds a deposit by reference", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeDepositRepository(storage);

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

      const reference = `deposit-${randomUUID()}`;

      const created = await repository.create({
        exchangeAssetAccountId: fixtures.exchangeAssetAccountId,
        networkId: fixtures.networkId,
        transactionHash: `tx-${randomUUID()}`,
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

  it("finds a deposit by network and transaction hash", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeDepositRepository(storage);

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

      const transactionHash = `tx-${randomUUID()}`;

      const created = await repository.create({
        exchangeAssetAccountId: fixtures.exchangeAssetAccountId,
        networkId: fixtures.networkId,
        transactionHash,
        amount: "5000000",
        reference: `deposit-${randomUUID()}`,
      });

      const found = await repository.findByTransaction(
        fixtures.networkId,
        transactionHash,
      );

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

  it("returns null for an unknown deposit", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeDepositRepository(storage);

    try {
      await storage.connect();

      const found = await repository.findById(randomUUID());

      expect(found).toBeNull();
    } finally {
      await storage.disconnect();
    }
  });

  it("enforces unique deposit references", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeDepositRepository(storage);

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

      const reference = `duplicate-deposit-${randomUUID()}`;

      const input = {
        exchangeAssetAccountId: fixtures.exchangeAssetAccountId,
        networkId: fixtures.networkId,
        transactionHash: `tx-${randomUUID()}`,
        amount: "1000000",
        reference,
      };

      await repository.create(input);

      await expect(
        repository.create({
          ...input,
          transactionHash: `tx-${randomUUID()}`,
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