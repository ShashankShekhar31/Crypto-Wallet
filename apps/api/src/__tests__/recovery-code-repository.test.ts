import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PostgresStorage } from "@crypto-wallet/storage";

import { RecoveryCodeRepository } from "../identity/recovery-code-repository.js";
import { generateRecoveryCodes } from "../identity/recovery-code.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required for recovery code repository tests",
  );
}

describe("RecoveryCodeRepository", () => {
  it("creates and lists unused recovery codes", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new RecoveryCodeRepository(storage);

    const userId = randomUUID();
    const identityAccountId = randomUUID();

    const codes = generateRecoveryCodes(3);

    try {
      await storage.connect();

      await storage.query(
        `
          INSERT INTO users (id)
          VALUES ($1)
        `,
        [userId],
      );

      await storage.query(
        `
          INSERT INTO identity_accounts (
            id,
            user_id,
            normalized_email,
            status
          )
          VALUES ($1, $2, $3, 'active')
        `,
        [
          identityAccountId,
          userId,
          `recovery-${randomUUID()}@example.com`,
        ],
      );

      const created = await repository.createCodes(
        identityAccountId,
        codes,
      );

      expect(created).toHaveLength(3);

      for (const record of created) {
        expect(record).toMatchObject({
          identityAccountId,
          usedAt: null,
        });

        expect(record.id).toEqual(
          expect.any(String),
        );

        expect(record.codeHash).toMatch(
          /^[0-9a-f]{64}$/,
        );

        expect(record.createdAt).toBeInstanceOf(
          Date,
        );
      }

      const listed =
        await repository.listUnusedCodes(
          identityAccountId,
        );

      expect(listed).toHaveLength(3);

      expect(
        listed.map((record) => record.codeHash),
      ).toEqual(
        created.map((record) => record.codeHash),
      );
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

  it("consumes a valid recovery code once", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new RecoveryCodeRepository(storage);

    const userId = randomUUID();
    const identityAccountId = randomUUID();

    const codes = generateRecoveryCodes(2);

    const code = codes[0];

    if (!code) {
      throw new Error("Recovery code was not generated");
    }

    try {
      await storage.connect();

      await storage.query(
        `
          INSERT INTO users (id)
          VALUES ($1)
        `,
        [userId],
      );

      await storage.query(
        `
          INSERT INTO identity_accounts (
            id,
            user_id,
            normalized_email,
            status
          )
          VALUES ($1, $2, $3, 'active')
        `,
        [
          identityAccountId,
          userId,
          `consume-${randomUUID()}@example.com`,
        ],
      );

      await repository.createCodes(
        identityAccountId,
        codes,
      );

      const consumed =
        await repository.consumeCode(
          identityAccountId,
          code,
        );

      expect(consumed).not.toBeNull();

      expect(consumed?.identityAccountId).toBe(
        identityAccountId,
      );

      expect(consumed?.usedAt).toBeInstanceOf(
        Date,
      );

      const unused =
        await repository.listUnusedCodes(
          identityAccountId,
        );

      expect(unused).toHaveLength(1);
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

  it("does not allow a recovery code to be consumed twice", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new RecoveryCodeRepository(storage);

    const userId = randomUUID();
    const identityAccountId = randomUUID();

    const codes = generateRecoveryCodes(1);

    const code = codes[0];

    if (!code) {
      throw new Error("Recovery code was not generated");
    }

    try {
      await storage.connect();

      await storage.query(
        `
          INSERT INTO users (id)
          VALUES ($1)
        `,
        [userId],
      );

      await storage.query(
        `
          INSERT INTO identity_accounts (
            id,
            user_id,
            normalized_email,
            status
          )
          VALUES ($1, $2, $3, 'active')
        `,
        [
          identityAccountId,
          userId,
          `single-use-${randomUUID()}@example.com`,
        ],
      );

      await repository.createCodes(
        identityAccountId,
        codes,
      );

      const first =
        await repository.consumeCode(
          identityAccountId,
          code,
        );

      expect(first).not.toBeNull();

      const second =
        await repository.consumeCode(
          identityAccountId,
          code,
        );

      expect(second).toBeNull();
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

  it("returns null for an invalid recovery code", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new RecoveryCodeRepository(storage);

    const userId = randomUUID();
    const identityAccountId = randomUUID();

    const codes = generateRecoveryCodes(1);

    try {
      await storage.connect();

      await storage.query(
        `
          INSERT INTO users (id)
          VALUES ($1)
        `,
        [userId],
      );

      await storage.query(
        `
          INSERT INTO identity_accounts (
            id,
            user_id,
            normalized_email,
            status
          )
          VALUES ($1, $2, $3, 'active')
        `,
        [
          identityAccountId,
          userId,
          `invalid-${randomUUID()}@example.com`,
        ],
      );

      await repository.createCodes(
        identityAccountId,
        codes,
      );

      const result =
        await repository.consumeCode(
          identityAccountId,
          `invalid-${randomUUID()}`,
        );

      expect(result).toBeNull();
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

  it("does not consume a code belonging to another identity account", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new RecoveryCodeRepository(storage);

    const firstUserId = randomUUID();
    const firstIdentityAccountId = randomUUID();

    const secondUserId = randomUUID();
    const secondIdentityAccountId = randomUUID();

    const codes = generateRecoveryCodes(1);

    const code = codes[0];

    if (!code) {
      throw new Error("Recovery code was not generated");
    }

    try {
      await storage.connect();

      await storage.query(
        `
          INSERT INTO users (id)
          VALUES ($1), ($2)
        `,
        [firstUserId, secondUserId],
      );

      await storage.query(
        `
          INSERT INTO identity_accounts (
            id,
            user_id,
            normalized_email,
            status
          )
          VALUES
            ($1, $2, $3, 'active'),
            ($4, $5, $6, 'active')
        `,
        [
          firstIdentityAccountId,
          firstUserId,
          `first-${randomUUID()}@example.com`,
          secondIdentityAccountId,
          secondUserId,
          `second-${randomUUID()}@example.com`,
        ],
      );

      await repository.createCodes(
        firstIdentityAccountId,
        codes,
      );

      const result =
        await repository.consumeCode(
          secondIdentityAccountId,
          code,
        );

      expect(result).toBeNull();

      const stillUnused =
        await repository.listUnusedCodes(
          firstIdentityAccountId,
        );

      expect(stillUnused).toHaveLength(1);
    } finally {
      await storage.query(
        `
          DELETE FROM users
          WHERE id IN ($1, $2)
        `,
        [firstUserId, secondUserId],
      );

      await storage.disconnect();
    }
  });

  it("revokes unused recovery codes", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new RecoveryCodeRepository(storage);

    const userId = randomUUID();
    const identityAccountId = randomUUID();

    const codes = generateRecoveryCodes(3);

    const firstCode = codes[0];

    if (!firstCode) {
      throw new Error("Recovery code was not generated");
    }

    try {
      await storage.connect();

      await storage.query(
        `
          INSERT INTO users (id)
          VALUES ($1)
        `,
        [userId],
      );

      await storage.query(
        `
          INSERT INTO identity_accounts (
            id,
            user_id,
            normalized_email,
            status
          )
          VALUES ($1, $2, $3, 'active')
        `,
        [
          identityAccountId,
          userId,
          `revoke-${randomUUID()}@example.com`,
        ],
      );

      await repository.createCodes(
        identityAccountId,
        codes,
      );

      await repository.consumeCode(
        identityAccountId,
        firstCode,
      );

      const deleted =
        await repository.revokeUnusedCodes(
          identityAccountId,
        );

      expect(deleted).toBe(2);

      const remaining =
        await repository.listUnusedCodes(
          identityAccountId,
        );

      expect(remaining).toHaveLength(0);
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