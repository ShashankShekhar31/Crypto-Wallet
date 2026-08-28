import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PostgresStorage } from "@crypto-wallet/storage";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for storage transaction tests");
}

describe("PostgresStorage transactions", () => {
  it("commits all queries when the transaction succeeds", async () => {
    const storage = new PostgresStorage(databaseUrl);

    const userId = randomUUID();

    try {
      await storage.connect();

      await storage.transaction(async (transaction) => {
        await transaction.query(
          `
            INSERT INTO users (id)
            VALUES ($1)
          `,
          [userId],
        );

        const result = await transaction.query<{ id: string }>(
          `
            SELECT id
            FROM users
            WHERE id = $1
          `,
          [userId],
        );

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]?.id).toBe(userId);
      });

      const result = await storage.query<{ id: string }>(
        `
          SELECT id
          FROM users
          WHERE id = $1
        `,
        [userId],
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.id).toBe(userId);
    } finally {
      await storage.query(
        `
          DELETE FROM users
          WHERE id = $1
        `,
        [userId],
      );

      await storage.disconnect();
    }
  });

  it("rolls back all queries when the transaction fails", async () => {
    const storage = new PostgresStorage(databaseUrl);

    const userId = randomUUID();

    try {
      await storage.connect();

      await expect(
        storage.transaction(async (transaction) => {
          await transaction.query(
            `
              INSERT INTO users (id)
              VALUES ($1)
            `,
            [userId],
          );

          throw new Error("intentional transaction failure");
        }),
      ).rejects.toThrow("intentional transaction failure");

      const result = await storage.query<{ id: string }>(
        `
          SELECT id
          FROM users
          WHERE id = $1
        `,
        [userId],
      );

      expect(result.rows).toHaveLength(0);
    } finally {
      await storage.query(
        `
          DELETE FROM users
          WHERE id = $1
        `,
        [userId],
      );

      await storage.disconnect();
    }
  });
});
