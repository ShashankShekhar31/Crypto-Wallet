import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PostgresStorage } from "@crypto-wallet/storage";

import { IdentityRepository } from "../identity/repository.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for identity repository tests");
}

describe("IdentityRepository", () => {
  it("finds an identity account by normalized email", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new IdentityRepository(storage);

    const userId = randomUUID();
    const identityAccountId = randomUUID();
    const email = `repo-test-${randomUUID()}@example.com`;

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
        [identityAccountId, userId, email],
      );

      const account = await repository.findByEmail(email);

      expect(account).not.toBeNull();

      expect(account).toMatchObject({
        id: identityAccountId,
        userId,
        normalizedEmail: email,
        status: "active",
      });

      expect(account?.createdAt).toBeInstanceOf(Date);
      expect(account?.updatedAt).toBeInstanceOf(Date);
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

  it("returns null when an identity account does not exist", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new IdentityRepository(storage);

    try {
      await storage.connect();

      const account = await repository.findByEmail(`missing-${randomUUID()}@example.com`);

      expect(account).toBeNull();
    } finally {
      await storage.disconnect();
    }
  });

  it("finds the password credential for an identity account", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new IdentityRepository(storage);

    const userId = randomUUID();
    const identityAccountId = randomUUID();
    const passwordCredentialId = randomUUID();
    const email = `password-test-${randomUUID()}@example.com`;

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
        [identityAccountId, userId, email],
      );

      await storage.query(
        `
          INSERT INTO password_credentials (
            id,
            identity_account_id,
            password_hash,
            failed_attempt_count
          )
          VALUES ($1, $2, $3, 0)
        `,
        [passwordCredentialId, identityAccountId, "test-scrypt-hash"],
      );

      const credential = await repository.findPasswordCredential(identityAccountId);

      expect(credential).not.toBeNull();

      expect(credential).toMatchObject({
        id: passwordCredentialId,
        identityAccountId,
        passwordHash: "test-scrypt-hash",
        failedAttemptCount: 0,
        lockedUntil: null,
      });

      expect(credential?.passwordChangedAt).toBeInstanceOf(Date);
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

  it("returns null when a password credential does not exist", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new IdentityRepository(storage);

    const missingIdentityAccountId = randomUUID();

    try {
      await storage.connect();

      const credential = await repository.findPasswordCredential(missingIdentityAccountId);

      expect(credential).toBeNull();
    } finally {
      await storage.disconnect();
    }
  });
  it("creates an identity account and password credential atomically", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new IdentityRepository(storage);

    const userId = randomUUID();
    const email = `create-${randomUUID()}@example.com`;

    try {
      await storage.connect();

      await storage.query(
        `
        INSERT INTO users (id)
        VALUES ($1)
      `,
        [userId],
      );

      const result = await repository.createIdentityAccount({
        userId,
        normalizedEmail: email,
        passwordHash: "test-scrypt-hash",
      });

      expect(result.identityAccount).toMatchObject({
        userId,
        normalizedEmail: email,
        status: "active",
      });

      expect(result.identityAccount.id).toEqual(expect.any(String));

      expect(result.identityAccount.createdAt).toBeInstanceOf(Date);
      expect(result.identityAccount.updatedAt).toBeInstanceOf(Date);

      expect(result.passwordCredential).toMatchObject({
        identityAccountId: result.identityAccount.id,
        passwordHash: "test-scrypt-hash",
        failedAttemptCount: 0,
        lockedUntil: null,
      });

      expect(result.passwordCredential.id).toEqual(expect.any(String));

      expect(result.passwordCredential.passwordChangedAt).toBeInstanceOf(Date);

      const identityRows = await storage.query(
        `
        SELECT id
        FROM identity_accounts
        WHERE id = $1
      `,
        [result.identityAccount.id],
      );

      const credentialRows = await storage.query(
        `
        SELECT id
        FROM password_credentials
        WHERE identity_account_id = $1
      `,
        [result.identityAccount.id],
      );

      expect(identityRows.rows).toHaveLength(1);
      expect(credentialRows.rows).toHaveLength(1);
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

  it("rejects a duplicate normalized email without creating another identity", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new IdentityRepository(storage);

    const firstUserId = randomUUID();
    const secondUserId = randomUUID();
    const email = `duplicate-${randomUUID()}@example.com`;

    try {
      await storage.connect();

      await storage.query(
        `
        INSERT INTO users (id)
        VALUES ($1), ($2)
      `,
        [firstUserId, secondUserId],
      );

      const first = await repository.createIdentityAccount({
        userId: firstUserId,
        normalizedEmail: email,
        passwordHash: "first-password-hash",
      });

      await expect(
        repository.createIdentityAccount({
          userId: secondUserId,
          normalizedEmail: email,
          passwordHash: "second-password-hash",
        }),
      ).rejects.toThrow();

      const identities = await storage.query(
        `
        SELECT
          id,
          user_id,
          normalized_email
        FROM identity_accounts
        WHERE normalized_email = $1
      `,
        [email],
      );

      const credentials = await storage.query(
        `
        SELECT
          id,
          identity_account_id,
          password_hash
        FROM password_credentials
        WHERE identity_account_id = $1
      `,
        [first.identityAccount.id],
      );

      expect(identities.rows).toHaveLength(1);
      expect(identities.rows[0]).toMatchObject({
        id: first.identityAccount.id,
        user_id: firstUserId,
        normalized_email: email,
      });

      expect(credentials.rows).toHaveLength(1);
      expect(credentials.rows[0]).toMatchObject({
        identity_account_id: first.identityAccount.id,
        password_hash: "first-password-hash",
      });
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
});
