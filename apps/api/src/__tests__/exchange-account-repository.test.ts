import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PostgresStorage } from "@crypto-wallet/storage";

import {
  ExchangeAccountRepository,
} from "../exchange/exchange-account-repository.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required for exchange account repository tests",
  );
}

describe("ExchangeAccountRepository", () => {
  it("creates and finds a customer exchange account", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeAccountRepository(storage);

    const ownerId = randomUUID();

    try {
      await storage.connect();

      const created = await repository.create({
        ownerType: "customer",
        ownerId,
        kind: "customer",
      });

      expect(created).toMatchObject({
        ownerType: "customer",
        ownerId,
        kind: "customer",
        status: "active",
      });

      expect(created.id).toBeTruthy();
      expect(created.createdAt).toBeInstanceOf(Date);

      const found = await repository.findById(created.id);

      expect(found).toEqual(created);
    } finally {
      await storage.query(
        `
          DELETE FROM exchange_accounts
          WHERE owner_id = $1
        `,
        [ownerId],
      );

      await storage.disconnect();
    }
  });

  it("finds an account by owner and kind", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeAccountRepository(storage);

    const ownerId = randomUUID();

    try {
      await storage.connect();

      const created = await repository.create({
        ownerType: "platform",
        ownerId,
        kind: "treasury",
      });

      const found = await repository.findByOwnerAndKind(
        "platform",
        ownerId,
        "treasury",
      );

      expect(found).toEqual(created);
    } finally {
      await storage.query(
        `
          DELETE FROM exchange_accounts
          WHERE owner_id = $1
        `,
        [ownerId],
      );

      await storage.disconnect();
    }
  });

  it("returns null for an unknown account", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeAccountRepository(storage);

    try {
      await storage.connect();

      const found = await repository.findById(randomUUID());

      expect(found).toBeNull();
    } finally {
      await storage.disconnect();
    }
  });

  it("enforces the database uniqueness boundary", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new ExchangeAccountRepository(storage);

    const ownerId = randomUUID();

    try {
      await storage.connect();

      await repository.create({
        ownerType: "customer",
        ownerId,
        kind: "customer",
      });

      await expect(
        repository.create({
          ownerType: "customer",
          ownerId,
          kind: "customer",
        }),
      ).rejects.toThrow();
    } finally {
      await storage.query(
        `
          DELETE FROM exchange_accounts
          WHERE owner_id = $1
        `,
        [ownerId],
      );

      await storage.disconnect();
    }
  });
});