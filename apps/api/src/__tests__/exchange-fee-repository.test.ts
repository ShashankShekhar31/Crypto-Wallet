import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PostgresStorage } from "@crypto-wallet/storage";

import { ExchangeFeeRepository } from "../exchange/exchange-fee-repository.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for exchange fee repository tests");
}

describe("ExchangeFeeRepository", () => {
  async function createFixtures(storage: PostgresStorage) {
    const buyerExchangeAccountId = randomUUID();
    const sellerExchangeAccountId = randomUUID();
    const feeExchangeAccountId = randomUUID();

    const networkId = randomUUID();
    const baseAssetId = randomUUID();
    const quoteAssetId = randomUUID();

    const buyerBaseExchangeAssetAccountId = randomUUID();
    const buyerQuoteExchangeAssetAccountId = randomUUID();
    const sellerBaseExchangeAssetAccountId = randomUUID();
    const sellerQuoteExchangeAssetAccountId = randomUUID();
    const feeExchangeAssetAccountId = randomUUID();

    const tradeId = randomUUID();

    await storage.query(
      `
      INSERT INTO exchange_accounts (
        id,
        owner_type,
        owner_id,
        kind
      )
      VALUES
        ($1, 'customer', $4, 'customer'),
        ($2, 'customer', $5, 'customer'),
        ($3, 'platform', $6, 'fee')
    `,
      [
        buyerExchangeAccountId,
        sellerExchangeAccountId,
        feeExchangeAccountId,
        randomUUID(),
        randomUUID(),
        randomUUID(),
      ],
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
      [networkId, `fee-test-${networkId}`, "Fee Test Network", "fee-test-chain", "test"],
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
        ($1, $3, $5, 'Fee Base Asset', 18, 'native'),
        ($2, $4, $6, 'Fee Quote Asset', 6, 'native')
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
        ($4, $8, $12, $13),
        ($14, $15, $9, $13)
    `,
      [
        buyerBaseExchangeAssetAccountId,
        buyerQuoteExchangeAssetAccountId,
        sellerBaseExchangeAssetAccountId,
        sellerQuoteExchangeAssetAccountId,
        buyerExchangeAccountId,
        buyerExchangeAccountId,
        sellerExchangeAccountId,
        sellerExchangeAccountId,
        baseAssetId,
        quoteAssetId,
        baseAssetId,
        quoteAssetId,
        networkId,
        feeExchangeAssetAccountId,
        feeExchangeAccountId,
      ],
    );

    await storage.query(
      `
      INSERT INTO exchange_trades (
        id,
        buyer_base_exchange_asset_account_id,
        buyer_quote_exchange_asset_account_id,
        seller_base_exchange_asset_account_id,
        seller_quote_exchange_asset_account_id,
        base_asset_id,
        quote_asset_id,
        base_amount,
        quote_amount,
        price_numerator,
        price_denominator,
        status,
        reference,
        executed_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        1000000,
        2000000,
        2,
        1,
        'executed',
        $8,
        NOW()
      )
    `,
      [
        tradeId,
        buyerBaseExchangeAssetAccountId,
        buyerQuoteExchangeAssetAccountId,
        sellerBaseExchangeAssetAccountId,
        sellerQuoteExchangeAssetAccountId,
        baseAssetId,
        quoteAssetId,
        `trade-${randomUUID()}`,
      ],
    );

    return {
      buyerExchangeAccountId,
      sellerExchangeAccountId,
      feeExchangeAccountId,
      networkId,
      baseAssetId,
      quoteAssetId,
      buyerBaseExchangeAssetAccountId,
      buyerQuoteExchangeAssetAccountId,
      sellerBaseExchangeAssetAccountId,
      sellerQuoteExchangeAssetAccountId,
      feeExchangeAssetAccountId,
      tradeId,
    };
  }

  async function cleanupFixtures(
    storage: PostgresStorage,
    fixtures: {
      buyerExchangeAccountId: string;
      sellerExchangeAccountId: string;
      feeExchangeAccountId: string;
      networkId: string;
      baseAssetId: string;
      quoteAssetId: string;
      tradeId: string;
    },
  ) {
    await storage.query(
      `
      DELETE FROM exchange_fees
      WHERE trade_id = $1
    `,
      [fixtures.tradeId],
    );

    await storage.query(
      `
      DELETE FROM exchange_trades
      WHERE id = $1
    `,
      [fixtures.tradeId],
    );

    await storage.query(
      `
      DELETE FROM exchange_asset_accounts
      WHERE exchange_account_id IN ($1, $2, $3)
    `,
      [
        fixtures.buyerExchangeAccountId,
        fixtures.sellerExchangeAccountId,
        fixtures.feeExchangeAccountId,
      ],
    );

    await storage.query(
      `
      DELETE FROM exchange_accounts
      WHERE id IN ($1, $2, $3)
    `,
      [
        fixtures.buyerExchangeAccountId,
        fixtures.sellerExchangeAccountId,
        fixtures.feeExchangeAccountId,
      ],
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

  it("creates and finds a fee", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeFeeRepository(storage);

    let fixtures: Awaited<ReturnType<typeof createFixtures>> | undefined;

    try {
      await storage.connect();

      fixtures = await createFixtures(storage);

      const created = await repository.create({
        tradeId: fixtures.tradeId,
        sourceExchangeAssetAccountId: fixtures.buyerBaseExchangeAssetAccountId,
        feeExchangeAssetAccountId: fixtures.feeExchangeAssetAccountId,
        assetId: fixtures.baseAssetId,
        amount: "2500",
        reference: `fee-${randomUUID()}`,
      });

      expect(created).toMatchObject({
        tradeId: fixtures.tradeId,
        sourceExchangeAssetAccountId: fixtures.buyerBaseExchangeAssetAccountId,
        feeExchangeAssetAccountId: fixtures.feeExchangeAssetAccountId,
        assetId: fixtures.baseAssetId,
        amount: "2500",
        status: "charged",
      });

      expect(created.createdAt).toBeInstanceOf(Date);

      const found = await repository.findById(created.id);

      expect(found).toEqual(created);
    } finally {
      if (fixtures) {
        await cleanupFixtures(storage, fixtures);
      }

      await storage.disconnect();
    }
  });

  it("finds a fee by reference", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeFeeRepository(storage);

    let fixtures: Awaited<ReturnType<typeof createFixtures>> | undefined;

    try {
      await storage.connect();

      fixtures = await createFixtures(storage);

      const reference = `fee-${randomUUID()}`;

      const created = await repository.create({
        tradeId: fixtures.tradeId,
        sourceExchangeAssetAccountId: fixtures.buyerBaseExchangeAssetAccountId,
        feeExchangeAssetAccountId: fixtures.feeExchangeAssetAccountId,
        assetId: fixtures.baseAssetId,
        amount: "5000",
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
    const repository = new ExchangeFeeRepository(storage);

    let fixtures: Awaited<ReturnType<typeof createFixtures>> | undefined;

    try {
      await storage.connect();

      fixtures = await createFixtures(storage);

      const created = await repository.create({
        tradeId: fixtures.tradeId,
        sourceExchangeAssetAccountId: fixtures.buyerBaseExchangeAssetAccountId,
        feeExchangeAssetAccountId: fixtures.feeExchangeAssetAccountId,
        assetId: fixtures.baseAssetId,
        amount: "1000",
        status: "reversed",
        reference: `fee-${randomUUID()}`,
      });

      expect(created.status).toBe("reversed");
    } finally {
      if (fixtures) {
        await cleanupFixtures(storage, fixtures);
      }

      await storage.disconnect();
    }
  });

  it("returns null for an unknown fee", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeFeeRepository(storage);

    try {
      await storage.connect();

      const found = await repository.findById(randomUUID());

      expect(found).toBeNull();
    } finally {
      await storage.disconnect();
    }
  });

  it("enforces unique fee references", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeFeeRepository(storage);

    let fixtures: Awaited<ReturnType<typeof createFixtures>> | undefined;

    try {
      await storage.connect();

      fixtures = await createFixtures(storage);

      const reference = `duplicate-fee-${randomUUID()}`;

      const input = {
        tradeId: fixtures.tradeId,
        sourceExchangeAssetAccountId: fixtures.buyerBaseExchangeAssetAccountId,
        feeExchangeAssetAccountId: fixtures.feeExchangeAssetAccountId,
        assetId: fixtures.baseAssetId,
        amount: "1000",
        reference,
      };

      await repository.create(input);

      await expect(
        repository.create({
          ...input,
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
