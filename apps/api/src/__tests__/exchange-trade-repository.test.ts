import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PostgresStorage } from "@crypto-wallet/storage";

import { ExchangeTradeRepository } from "../exchange/exchange-trade-repository.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for exchange trade repository tests");
}

describe("ExchangeTradeRepository", () => {
  async function createFixtures(storage: PostgresStorage) {
    const buyerExchangeAccountId = randomUUID();
    const sellerExchangeAccountId = randomUUID();

    const networkId = randomUUID();
    const baseAssetId = randomUUID();
    const quoteAssetId = randomUUID();

    const buyerBaseAccountId = randomUUID();
    const buyerQuoteAccountId = randomUUID();
    const sellerBaseAccountId = randomUUID();
    const sellerQuoteAccountId = randomUUID();

    await storage.query(
      `
    INSERT INTO exchange_accounts (
      id,
      owner_type,
      owner_id,
      kind
    )
    VALUES
      ($1, 'customer', $3, 'customer'),
      ($2, 'customer', $4, 'customer')
  `,
      [buyerExchangeAccountId, sellerExchangeAccountId, randomUUID(), randomUUID()],
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
      [networkId, `trade-test-${networkId}`, "Trade Test Network", "trade-test-chain", "test"],
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
        VALUES
          ($1, $3, $5, 'Trade Base Asset', 18, 'native'),
          ($2, $4, $6, 'Trade Quote Asset', 6, 'native')
      `,
      [
        baseAssetId,
        quoteAssetId,
        networkId,
        networkId,
        `B${baseAssetId.slice(0, 6)}`,
        `Q${quoteAssetId.slice(0, 6)}`,
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
        VALUES
            ($1, $5, $9, $13),
            ($2, $6, $10, $13),
            ($3, $7, $11, $13),
            ($4, $8, $12, $13)
      `,
      [
        buyerBaseAccountId,
        buyerQuoteAccountId,
        sellerBaseAccountId,
        sellerQuoteAccountId,
        buyerExchangeAccountId,
        buyerExchangeAccountId,
        sellerExchangeAccountId,
        sellerExchangeAccountId,
        baseAssetId,
        quoteAssetId,
        baseAssetId,
        quoteAssetId,
        networkId,
      ],
    );

    return {
      buyerExchangeAccountId,
      sellerExchangeAccountId,
      networkId,
      baseAssetId,
      quoteAssetId,
      buyerBaseAccountId,
      buyerQuoteAccountId,
      sellerBaseAccountId,
      sellerQuoteAccountId,
    };
  }

  async function cleanupFixtures(
    storage: PostgresStorage,
    fixtures: {
      buyerExchangeAccountId: string;
      sellerExchangeAccountId: string;
      networkId: string;
      baseAssetId: string;
      quoteAssetId: string;
    },
  ) {
    await storage.query(
      `
    DELETE FROM exchange_trades
    WHERE buyer_base_exchange_asset_account_id IN (
      SELECT id
      FROM exchange_asset_accounts
      WHERE exchange_account_id IN ($1, $2)
    )
    OR buyer_quote_exchange_asset_account_id IN (
      SELECT id
      FROM exchange_asset_accounts
      WHERE exchange_account_id IN ($1, $2)
    )
    OR seller_base_exchange_asset_account_id IN (
      SELECT id
      FROM exchange_asset_accounts
      WHERE exchange_account_id IN ($1, $2)
    )
    OR seller_quote_exchange_asset_account_id IN (
      SELECT id
      FROM exchange_asset_accounts
      WHERE exchange_account_id IN ($1, $2)
    )
  `,
      [fixtures.buyerExchangeAccountId, fixtures.sellerExchangeAccountId],
    );

    await storage.query(
      `
        DELETE FROM exchange_asset_accounts
        WHERE exchange_account_id IN ($1, $2)
      `,
      [fixtures.buyerExchangeAccountId, fixtures.sellerExchangeAccountId],
    );

    await storage.query(
      `
        DELETE FROM exchange_accounts
        WHERE id IN ($1, $2)
      `,
      [fixtures.buyerExchangeAccountId, fixtures.sellerExchangeAccountId],
    );

    await storage.query(
      `
        DELETE FROM assets
        WHERE id IN ($1, $2)
      `,
      [fixtures.baseAssetId, fixtures.quoteAssetId],
    );

    await storage.query(
      `
        DELETE FROM networks
        WHERE id = $1
      `,
      [fixtures.networkId],
    );
  }

  it("creates and finds a trade", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeTradeRepository(storage);

    let fixtures: Awaited<ReturnType<typeof createFixtures>> | undefined;

    try {
      await storage.connect();

      fixtures = await createFixtures(storage);

      const created = await repository.create({
        buyerBaseExchangeAssetAccountId: fixtures.buyerBaseAccountId,
        buyerQuoteExchangeAssetAccountId: fixtures.buyerQuoteAccountId,
        sellerBaseExchangeAssetAccountId: fixtures.sellerBaseAccountId,
        sellerQuoteExchangeAssetAccountId: fixtures.sellerQuoteAccountId,
        baseAssetId: fixtures.baseAssetId,
        quoteAssetId: fixtures.quoteAssetId,
        baseAmount: "1250000",
        quoteAmount: "2500000",
        priceNumerator: "2",
        priceDenominator: "1",
        reference: `trade-${randomUUID()}`,
      });

      expect(created).toMatchObject({
        buyerBaseExchangeAssetAccountId: fixtures.buyerBaseAccountId,
        buyerQuoteExchangeAssetAccountId: fixtures.buyerQuoteAccountId,
        sellerBaseExchangeAssetAccountId: fixtures.sellerBaseAccountId,
        sellerQuoteExchangeAssetAccountId: fixtures.sellerQuoteAccountId,
        baseAssetId: fixtures.baseAssetId,
        quoteAssetId: fixtures.quoteAssetId,
        baseAmount: "1250000",
        quoteAmount: "2500000",
        priceNumerator: "2",
        priceDenominator: "1",
        status: "executed",
      });

      expect(created.executedAt).toBeInstanceOf(Date);

      const found = await repository.findById(created.id);

      expect(found).toEqual(created);
    } finally {
      if (fixtures) {
        await cleanupFixtures(storage, fixtures);
      }

      await storage.disconnect();
    }
  });

  it("finds a trade by reference", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeTradeRepository(storage);

    let fixtures: Awaited<ReturnType<typeof createFixtures>> | undefined;

    try {
      await storage.connect();

      fixtures = await createFixtures(storage);

      const reference = `trade-${randomUUID()}`;

      const created = await repository.create({
        buyerBaseExchangeAssetAccountId: fixtures.buyerBaseAccountId,
        buyerQuoteExchangeAssetAccountId: fixtures.buyerQuoteAccountId,
        sellerBaseExchangeAssetAccountId: fixtures.sellerBaseAccountId,
        sellerQuoteExchangeAssetAccountId: fixtures.sellerQuoteAccountId,
        baseAssetId: fixtures.baseAssetId,
        quoteAssetId: fixtures.quoteAssetId,
        baseAmount: "1000000",
        quoteAmount: "3000000",
        priceNumerator: "3",
        priceDenominator: "1",
        reference,
      });

      const found = await repository.findByReference(reference);

      expect(found).toEqual(created);
    } finally {
      if (fixtures) {
        await cleanupFixtures(storage, fixtures);
      }

      await storage.disconnect();
    }
  });

  it("preserves an explicitly supplied reversed status", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeTradeRepository(storage);

    let fixtures: Awaited<ReturnType<typeof createFixtures>> | undefined;

    try {
      await storage.connect();

      fixtures = await createFixtures(storage);

      const created = await repository.create({
        buyerBaseExchangeAssetAccountId: fixtures.buyerBaseAccountId,
        buyerQuoteExchangeAssetAccountId: fixtures.buyerQuoteAccountId,
        sellerBaseExchangeAssetAccountId: fixtures.sellerBaseAccountId,
        sellerQuoteExchangeAssetAccountId: fixtures.sellerQuoteAccountId,
        baseAssetId: fixtures.baseAssetId,
        quoteAssetId: fixtures.quoteAssetId,
        baseAmount: "1000000",
        quoteAmount: "2000000",
        priceNumerator: "2",
        priceDenominator: "1",
        status: "reversed",
        reference: `trade-${randomUUID()}`,
      });

      expect(created.status).toBe("reversed");
    } finally {
      if (fixtures) {
        await cleanupFixtures(storage, fixtures);
      }

      await storage.disconnect();
    }
  });

  it("returns null for an unknown trade", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeTradeRepository(storage);

    try {
      await storage.connect();

      const found = await repository.findById(randomUUID());

      expect(found).toBeNull();
    } finally {
      await storage.disconnect();
    }
  });

  it("enforces unique trade references", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeTradeRepository(storage);

    let fixtures: Awaited<ReturnType<typeof createFixtures>> | undefined;

    try {
      await storage.connect();

      fixtures = await createFixtures(storage);

      const reference = `duplicate-trade-${randomUUID()}`;

      const input = {
        buyerBaseExchangeAssetAccountId: fixtures.buyerBaseAccountId,
        buyerQuoteExchangeAssetAccountId: fixtures.buyerQuoteAccountId,
        sellerBaseExchangeAssetAccountId: fixtures.sellerBaseAccountId,
        sellerQuoteExchangeAssetAccountId: fixtures.sellerQuoteAccountId,
        baseAssetId: fixtures.baseAssetId,
        quoteAssetId: fixtures.quoteAssetId,
        baseAmount: "1000000",
        quoteAmount: "2000000",
        priceNumerator: "2",
        priceDenominator: "1",
        reference,
      };

      await repository.create(input);

      await expect(
        repository.create({
          ...input,
          reference,
        }),
      ).rejects.toThrow();
    } finally {
      if (fixtures) {
        await cleanupFixtures(storage, fixtures);
      }

      await storage.disconnect();
    }
  });
});
