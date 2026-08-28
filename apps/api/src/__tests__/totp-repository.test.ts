import { randomBytes, randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PostgresStorage } from "@crypto-wallet/storage";

import { TotpRepository } from "../identity/totp-repository.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for TOTP repository tests");
}

describe("TotpRepository", () => {
  it("creates and finds a TOTP factor", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new TotpRepository(storage);

    const userId = randomUUID();
    const identityAccountId = randomUUID();

    const encryptedSecret = randomBytes(32);
    const secretNonce = randomBytes(12);

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
        [identityAccountId, userId, `totp-${randomUUID()}@example.com`],
      );

      const created = await repository.createFactor({
        identityAccountId,
        encryptedSecret,
        secretNonce,
        encryptionKeyVersion: "v1",
      });

      expect(created).toMatchObject({
        identityAccountId,
        encryptionKeyVersion: "v1",
        enabledAt: null,
        disabledAt: null,
      });

      expect(created.id).toEqual(expect.any(String));

      expect(created.encryptedSecret).toEqual(encryptedSecret);

      expect(created.secretNonce).toEqual(secretNonce);

      expect(created.createdAt).toBeInstanceOf(Date);

      const found = await repository.findById(created.id);

      expect(found).not.toBeNull();

      expect(found?.identityAccountId).toBe(identityAccountId);

      expect(found?.encryptedSecret).toEqual(encryptedSecret);

      expect(found?.secretNonce).toEqual(secretNonce);

      expect(found?.encryptionKeyVersion).toBe("v1");
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

  it("returns null for an unknown factor", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new TotpRepository(storage);

    try {
      await storage.connect();

      const result = await repository.findById(randomUUID());

      expect(result).toBeNull();
    } finally {
      await storage.disconnect();
    }
  });

  it("enables a TOTP factor", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new TotpRepository(storage);

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
        [identityAccountId, userId, `enable-${randomUUID()}@example.com`],
      );

      const factor = await repository.createFactor({
        identityAccountId,
        encryptedSecret: randomBytes(32),
        secretNonce: randomBytes(12),
        encryptionKeyVersion: "v1",
      });

      expect(factor.enabledAt).toBeNull();

      const enabled = await repository.enableFactor(factor.id);

      expect(enabled).not.toBeNull();

      expect(enabled?.enabledAt).toBeInstanceOf(Date);

      expect(enabled?.disabledAt).toBeNull();
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

  it("finds an active TOTP factor", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new TotpRepository(storage);

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
        [identityAccountId, userId, `active-${randomUUID()}@example.com`],
      );

      const factor = await repository.createFactor({
        identityAccountId,
        encryptedSecret: randomBytes(32),
        secretNonce: randomBytes(12),
        encryptionKeyVersion: "v1",
      });

      await repository.enableFactor(factor.id);

      const active = await repository.findActiveByIdentityAccountId(identityAccountId);

      expect(active).not.toBeNull();

      expect(active?.id).toBe(factor.id);

      expect(active?.enabledAt).toBeInstanceOf(Date);

      expect(active?.disabledAt).toBeNull();
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

  it("disables an active TOTP factor", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new TotpRepository(storage);

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
        [identityAccountId, userId, `disable-${randomUUID()}@example.com`],
      );

      const factor = await repository.createFactor({
        identityAccountId,
        encryptedSecret: randomBytes(32),
        secretNonce: randomBytes(12),
        encryptionKeyVersion: "v1",
      });

      await repository.enableFactor(factor.id);

      const disabled = await repository.disableFactor(factor.id);

      expect(disabled).not.toBeNull();

      expect(disabled?.disabledAt).toBeInstanceOf(Date);

      const active = await repository.findActiveByIdentityAccountId(identityAccountId);

      expect(active).toBeNull();
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

  it("rejects an empty encrypted secret", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new TotpRepository(storage);

    try {
      await storage.connect();

      await expect(
        repository.createFactor({
          identityAccountId: randomUUID(),
          encryptedSecret: Buffer.alloc(0),
          secretNonce: randomBytes(12),
          encryptionKeyVersion: "v1",
        }),
      ).rejects.toThrow("Encrypted TOTP secret is required");
    } finally {
      await storage.disconnect();
    }
  });

  it("rejects an empty encryption key version", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new TotpRepository(storage);

    try {
      await storage.connect();

      await expect(
        repository.createFactor({
          identityAccountId: randomUUID(),
          encryptedSecret: randomBytes(32),
          secretNonce: randomBytes(12),
          encryptionKeyVersion: " ",
        }),
      ).rejects.toThrow("TOTP encryption key version is required");
    } finally {
      await storage.disconnect();
    }
  });
});
