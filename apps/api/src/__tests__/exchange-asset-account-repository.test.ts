import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PostgresStorage } from "@crypto-wallet/storage";

import {
  ExchangeAssetAccountRepository,
} from "../exchange/exchange-asset-account-repository.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required for exchange asset account repository tests",
  );
}

describe("ExchangeAssetAccountRepository", () => {
  async function createFixtures(storage: PostgresStorage) {
    const exchangeAccountId = randomUUID();
    const networkId = randomUUID();
    const assetId = randomUUID();

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
        `test-${networkId}`,
        "Test Network",
        "test-chain",
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
        `T${assetId.slice(0, 6)}`,
        "Test Asset",
        18,
        "native",
      ],
    );

    return {
      exchangeAccountId,
      networkId,
      assetId,
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

  it("creates and finds an exchange asset account", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeAssetAccountRepository(storage);

    let fixtures:
      | {
          exchangeAccountId: string;
          networkId: string;
          assetId: string;
        }
      | undefined;

    try {
      await storage.connect();

      fixtures = await createFixtures(storage);

      const created = await repository.create({
        exchangeAccountId: fixtures.exchangeAccountId,
        assetId: fixtures.assetId,
        networkId: fixtures.networkId,
      });

      expect(created).toMatchObject({
        exchangeAccountId: fixtures.exchangeAccountId,
        assetId: fixtures.assetId,
        networkId: fixtures.networkId,
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

  it("finds an asset account by exchange account and asset", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeAssetAccountRepository(storage);

    let fixtures:
      | {
          exchangeAccountId: string;
          networkId: string;
          assetId: string;
        }
      | undefined;

    try {
      await storage.connect();

      fixtures = await createFixtures(storage);

      const created = await repository.create({
        exchangeAccountId: fixtures.exchangeAccountId,
        assetId: fixtures.assetId,
        networkId: fixtures.networkId,
      });

      const found = await repository.findByAccountAndAsset(
        fixtures.exchangeAccountId,
        fixtures.assetId,
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

  it("lists asset accounts for an exchange account", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeAssetAccountRepository(storage);

    let exchangeAccountId: string | undefined;
    let networkId: string | undefined;
    let assetId: string | undefined;
    let secondAssetId: string | undefined;

    try {
      await storage.connect();

      const fixtures = await createFixtures(storage);

      exchangeAccountId = fixtures.exchangeAccountId;
      networkId = fixtures.networkId;
      assetId = fixtures.assetId;
      secondAssetId = randomUUID();

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
          secondAssetId,
          networkId,
          `U${secondAssetId.slice(0, 6)}`,
          "Second Test Asset",
          18,
          "native",
        ],
      );

      const first = await repository.create({
        exchangeAccountId,
        assetId,
        networkId,
      });

      const second = await repository.create({
        exchangeAccountId,
        assetId: secondAssetId,
        networkId,
      });

      const listed = await repository.listByExchangeAccount(
        exchangeAccountId,
      );

      expect(listed).toEqual([first, second]);
    } finally {
      if (exchangeAccountId) {
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
      }

      if (assetId) {
        await storage.query(
          `DELETE FROM assets WHERE id = $1`,
          [assetId],
        );
      }

      if (secondAssetId) {
        await storage.query(
          `DELETE FROM assets WHERE id = $1`,
          [secondAssetId],
        );
      }

      if (networkId) {
        await storage.query(
          `DELETE FROM networks WHERE id = $1`,
          [networkId],
        );
      }

      await storage.disconnect();
    }
  });

  it("rejects an asset paired with the wrong network", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeAssetAccountRepository(storage);

    let exchangeAccountId: string | undefined;
    let networkId: string | undefined;
    let assetId: string | undefined;
    let wrongNetworkId: string | undefined;

    try {
      await storage.connect();

      const fixtures = await createFixtures(storage);

      exchangeAccountId = fixtures.exchangeAccountId;
      networkId = fixtures.networkId;
      assetId = fixtures.assetId;
      wrongNetworkId = randomUUID();

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
          wrongNetworkId,
          `wrong-${wrongNetworkId}`,
          "Wrong Network",
          "wrong-chain",
          "test",
        ],
      );

      await expect(
        repository.create({
          exchangeAccountId,
          assetId,
          networkId: wrongNetworkId,
        }),
      ).rejects.toThrow();
    } finally {
      if (exchangeAccountId) {
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
      }

      if (assetId) {
        await storage.query(
          `DELETE FROM assets WHERE id = $1`,
          [assetId],
        );
      }

      if (wrongNetworkId) {
        await storage.query(
          `DELETE FROM networks WHERE id = $1`,
          [wrongNetworkId],
        );
      }

      if (networkId) {
        await storage.query(
          `DELETE FROM networks WHERE id = $1`,
          [networkId],
        );
      }

      await storage.disconnect();
    }
  });

  it("enforces one asset account per exchange account and asset", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeAssetAccountRepository(storage);

    let fixtures:
      | {
          exchangeAccountId: string;
          networkId: string;
          assetId: string;
        }
      | undefined;

    try {
      await storage.connect();

      fixtures = await createFixtures(storage);

      await repository.create({
        exchangeAccountId: fixtures.exchangeAccountId,
        assetId: fixtures.assetId,
        networkId: fixtures.networkId,
      });

      await expect(
        repository.create({
          exchangeAccountId: fixtures.exchangeAccountId,
          assetId: fixtures.assetId,
          networkId: fixtures.networkId,
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