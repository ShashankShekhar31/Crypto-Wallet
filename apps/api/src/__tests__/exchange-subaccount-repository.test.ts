import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PostgresStorage } from "@crypto-wallet/storage";

import {
  ExchangeSubaccountRepository,
} from "../exchange/exchange-subaccount-repository.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required for exchange subaccount repository tests",
  );
}

describe("ExchangeSubaccountRepository", () => {
  it("creates and finds a subaccount", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeSubaccountRepository(storage);

    const exchangeAccountId = randomUUID();

    try {
      await storage.connect();

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

      const created = await repository.create({
        exchangeAccountId,
        name: "spot",
      });

      expect(created).toMatchObject({
        exchangeAccountId,
        name: "spot",
      });

      expect(created.id).toBeTruthy();
      expect(created.createdAt).toBeInstanceOf(Date);

      const found = await repository.findById(created.id);

      expect(found).toEqual(created);

    } finally {
      await storage.query(
        `
          DELETE FROM exchange_subaccounts
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

      await storage.disconnect();
    }
  });

  it("lists subaccounts for an exchange account", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeSubaccountRepository(storage);

    const exchangeAccountId = randomUUID();

    try {
      await storage.connect();

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

      const first = await repository.create({
        exchangeAccountId,
        name: "spot",
      });

      const second = await repository.create({
        exchangeAccountId,
        name: "margin",
      });

      const listed = await repository.listByExchangeAccount(
        exchangeAccountId,
      );

      expect(listed).toEqual([first, second]);
    } finally {
      await storage.query(
        `
          DELETE FROM exchange_subaccounts
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

      await storage.disconnect();
    }
  });

  it("returns null for an unknown subaccount", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeSubaccountRepository(storage);

    try {
      await storage.connect();

      const found = await repository.findById(randomUUID());

      expect(found).toBeNull();
    } finally {
      await storage.disconnect();
    }
  });

  it("enforces unique subaccount names per exchange account", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeSubaccountRepository(storage);

    const exchangeAccountId = randomUUID();

    try {
      await storage.connect();

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

      await repository.create({
        exchangeAccountId,
        name: "spot",
      });

      await expect(
        repository.create({
          exchangeAccountId,
          name: "spot",
        }),
      ).rejects.toThrow();
    } finally {
      await storage.query(
        `
          DELETE FROM exchange_subaccounts
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

      await storage.disconnect();
    }
  });
});