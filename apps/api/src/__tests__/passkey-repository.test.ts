import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PostgresStorage } from "@crypto-wallet/storage";

import { PasskeyRepository } from "../identity/passkey-repository.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for passkey repository tests");
}

describe("PasskeyRepository", () => {
  it("creates and finds a passkey credential", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new PasskeyRepository(storage);

    const userId = randomUUID();
    const identityAccountId = randomUUID();

    const credentialId = Buffer.from(`credential-${randomUUID()}`);

    const publicKey = Buffer.from(`public-key-${randomUUID()}`);

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
        [identityAccountId, userId, `passkey-${randomUUID()}@example.com`],
      );

      const created = await repository.createCredential({
        identityAccountId,
        credentialId,
        publicKey,
        signCount: 0,
        backedUp: true,
      });

      expect(created).toMatchObject({
        identityAccountId,
        signCount: 0,
        backedUp: true,
        lastUsedAt: null,
        revokedAt: null,
      });

      expect(created.id).toEqual(expect.any(String));

      expect(created.credentialId).toEqual(credentialId);

      expect(created.publicKey).toEqual(publicKey);

      expect(created.createdAt).toBeInstanceOf(Date);

      const found = await repository.findByCredentialId(credentialId);

      expect(found).not.toBeNull();

      expect(found).toMatchObject({
        id: created.id,
        identityAccountId,
        signCount: 0,
        backedUp: true,
      });

      expect(found?.credentialId).toEqual(credentialId);

      expect(found?.publicKey).toEqual(publicKey);
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

  it("returns null when the credential does not exist", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new PasskeyRepository(storage);

    try {
      await storage.connect();

      const credential = await repository.findByCredentialId(
        Buffer.from(`missing-${randomUUID()}`),
      );

      expect(credential).toBeNull();
    } finally {
      await storage.disconnect();
    }
  });

  it("updates the sign count when the new count is greater", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new PasskeyRepository(storage);

    const userId = randomUUID();
    const identityAccountId = randomUUID();

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
        [identityAccountId, userId, `sign-count-${randomUUID()}@example.com`],
      );

      const credential = await repository.createCredential({
        identityAccountId,
        credentialId: Buffer.from(`credential-${randomUUID()}`),
        publicKey: Buffer.from(`public-key-${randomUUID()}`),
        signCount: 3,
      });

      const updated = await repository.updateSignCount(credential.id, 4);

      expect(updated).not.toBeNull();

      expect(updated?.signCount).toBe(4);
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

  it("does not decrease the sign count", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new PasskeyRepository(storage);

    const userId = randomUUID();
    const identityAccountId = randomUUID();

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
        [identityAccountId, userId, `non-decreasing-${randomUUID()}@example.com`],
      );

      const credential = await repository.createCredential({
        identityAccountId,
        credentialId: Buffer.from(`credential-${randomUUID()}`),
        publicKey: Buffer.from(`public-key-${randomUUID()}`),
        signCount: 5,
      });

      const updated = await repository.updateSignCount(credential.id, 4);

      expect(updated).toBeNull();

      const found = await repository.findByCredentialId(credential.credentialId);

      expect(found?.signCount).toBe(5);
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

  it("marks an active credential as used", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new PasskeyRepository(storage);

    const userId = randomUUID();
    const identityAccountId = randomUUID();

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
        [identityAccountId, userId, `mark-used-${randomUUID()}@example.com`],
      );

      const credential = await repository.createCredential({
        identityAccountId,
        credentialId: Buffer.from(`credential-${randomUUID()}`),
        publicKey: Buffer.from(`public-key-${randomUUID()}`),
      });

      expect(credential.lastUsedAt).toBeNull();

      const updated = await repository.markUsed(credential.id);

      expect(updated).not.toBeNull();

      expect(updated?.lastUsedAt).toBeInstanceOf(Date);
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

  it("revokes an active credential", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new PasskeyRepository(storage);

    const userId = randomUUID();
    const identityAccountId = randomUUID();

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
        [identityAccountId, userId, `revoke-${randomUUID()}@example.com`],
      );

      const credential = await repository.createCredential({
        identityAccountId,
        credentialId: Buffer.from(`credential-${randomUUID()}`),
        publicKey: Buffer.from(`public-key-${randomUUID()}`),
      });

      const revoked = await repository.revokeCredential(credential.id);

      expect(revoked).not.toBeNull();

      expect(revoked?.revokedAt).toBeInstanceOf(Date);

      const found = await repository.findByCredentialId(credential.credentialId);

      expect(found?.revokedAt).toBeInstanceOf(Date);
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
