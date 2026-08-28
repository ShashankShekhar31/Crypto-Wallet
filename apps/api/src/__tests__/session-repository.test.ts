import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PostgresStorage } from "@crypto-wallet/storage";

import { SessionRepository } from "../identity/session-repository.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for session repository tests");
}

describe("SessionRepository", () => {
  it("creates an active auth session", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new SessionRepository(storage);

    const userId = randomUUID();
    const deviceId = randomUUID();

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const idleExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

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
          INSERT INTO devices (
            id,
            user_id,
            platform,
            name
          )
          VALUES ($1, $2, $3, $4)
        `,
        [deviceId, userId, "test", "session-repository-test"],
      );

      const session = await repository.createSession({
        userId,
        deviceId,
        refreshTokenHash: `refresh-${randomUUID()}`,
        expiresAt,
        idleExpiresAt,
      });

      expect(session).toMatchObject({
        userId,
        deviceId,
        status: "active",
        refreshTokenHash: expect.any(String),
        tokenFamilyId: expect.any(String),
      });

      expect(session.id).toEqual(expect.any(String));

      expect(session.issuedAt).toBeInstanceOf(Date);
      expect(session.lastSeenAt).toBeInstanceOf(Date);
      expect(session.expiresAt).toBeInstanceOf(Date);
      expect(session.idleExpiresAt).toBeInstanceOf(Date);

      expect(session.rotatedAt).toBeNull();
      expect(session.revokedAt).toBeNull();
      expect(session.revokedReason).toBeNull();
      expect(session.replacedBySessionId).toBeNull();
    } finally {
      await storage.query(
        `
          DELETE FROM devices
          WHERE id = $1
        `,
        [deviceId],
      );
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

  it("finds a session by refresh token hash", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new SessionRepository(storage);

    const userId = randomUUID();
    const deviceId = randomUUID();
    const refreshTokenHash = `refresh-${randomUUID()}`;

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
          INSERT INTO devices (
            id,
            user_id,
            platform,
            name
          )
          VALUES ($1, $2, $3, $4)
        `,
        [deviceId, userId, "test", "session-repository-test"],
      );

      const session = await repository.createSession({
        userId,
        deviceId,
        refreshTokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        idleExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      const found = await repository.findByRefreshTokenHash(refreshTokenHash);

      expect(found).not.toBeNull();

      expect(found).toMatchObject({
        id: session.id,
        userId,
        deviceId,
        tokenFamilyId: session.tokenFamilyId,
        refreshTokenHash,
        status: "active",
      });
    } finally {
      await storage.query(
        `
          DELETE FROM devices
          WHERE id = $1
        `,
        [deviceId],
      );

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

  it("returns null when a refresh token hash does not exist", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new SessionRepository(storage);

    try {
      await storage.connect();

      const session = await repository.findByRefreshTokenHash(`missing-${randomUUID()}`);

      expect(session).toBeNull();
    } finally {
      await storage.disconnect();
    }
  });

  it("revokes an active session", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new SessionRepository(storage);

    const userId = randomUUID();
    const deviceId = randomUUID();

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
          INSERT INTO devices (
            id,
            user_id,
            platform,
            name
          )
          VALUES ($1, $2, $3, $4)
        `,
        [deviceId, userId, "test", "session-repository-test"],
      );

      const session = await repository.createSession({
        userId,
        deviceId,
        refreshTokenHash: `refresh-${randomUUID()}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        idleExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      const revoked = await repository.revokeSession(session.id, "user_logout");

      expect(revoked).not.toBeNull();

      expect(revoked).toMatchObject({
        id: session.id,
        status: "revoked",
        revokedReason: "user_logout",
      });

      expect(revoked?.revokedAt).toBeInstanceOf(Date);
    } finally {
      await storage.query(
        `
          DELETE FROM devices
          WHERE id = $1
        `,
        [deviceId],
      );

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
  it("rotates an active session atomically", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new SessionRepository(storage);

    const userId = randomUUID();
    const deviceId = randomUUID();

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
        INSERT INTO devices (
          id,
          user_id,
          platform,
          name
        )
        VALUES ($1, $2, $3, $4)
      `,
        [deviceId, userId, "test", "session-rotation-test"],
      );

      const original = await repository.createSession({
        userId,
        deviceId,
        refreshTokenHash: `refresh-${randomUUID()}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        idleExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      const rotated = await repository.rotateSession(original.id, {
        userId,
        deviceId,
        refreshTokenHash: `replacement-${randomUUID()}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        idleExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      expect(rotated.previousSession).toMatchObject({
        id: original.id,
        userId,
        deviceId,
        tokenFamilyId: original.tokenFamilyId,
        status: "rotated",
        replacedBySessionId: rotated.replacementSession.id,
      });

      expect(rotated.previousSession.rotatedAt).toBeInstanceOf(Date);

      expect(rotated.replacementSession).toMatchObject({
        userId,
        deviceId,
        tokenFamilyId: original.tokenFamilyId,
        status: "active",
      });

      expect(rotated.replacementSession.id).not.toBe(original.id);

      const storedOriginal = await repository.findByRefreshTokenHash(original.refreshTokenHash);

      expect(storedOriginal?.status).toBe("rotated");

      const storedReplacement = await repository.findByRefreshTokenHash(
        rotated.replacementSession.refreshTokenHash,
      );

      expect(storedReplacement?.status).toBe("active");
    } finally {
      await storage.query(
        `
        DELETE FROM devices
        WHERE id = $1
      `,
        [deviceId],
      );

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
  it("detects refresh token replay and revokes the token family", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new SessionRepository(storage);

    const userId = randomUUID();
    const deviceId = randomUUID();

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
          INSERT INTO devices (
            id,
            user_id,
            platform,
            name
          )
          VALUES ($1, $2, $3, $4)
        `,
        [deviceId, userId, "test", "session-replay-test"],
      );

      const original = await repository.createSession({
        userId,
        deviceId,
        refreshTokenHash: `refresh-${randomUUID()}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        idleExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      const rotated = await repository.rotateSession(original.id, {
        userId,
        deviceId,
        refreshTokenHash: `replacement-${randomUUID()}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        idleExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      await repository.handleRefreshTokenReplay(original.id, original.tokenFamilyId);

      const replayed = await repository.findByRefreshTokenHash(original.refreshTokenHash);

      expect(replayed).toMatchObject({
        id: original.id,
        status: "replay_detected",
        revokedReason: "refresh_token_replay",
      });

      expect(replayed?.revokedAt).toBeInstanceOf(Date);

      const replacement = await repository.findByRefreshTokenHash(
        rotated.replacementSession.refreshTokenHash,
      );

      expect(replacement).toMatchObject({
        id: rotated.replacementSession.id,
        status: "revoked",
        revokedReason: "refresh_token_replay",
      });

      expect(replacement?.revokedAt).toBeInstanceOf(Date);
    } finally {
      await storage.query(
        `
          DELETE FROM devices
          WHERE id = $1
        `,
        [deviceId],
      );

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
  it("does not revoke sessions from another token family", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new SessionRepository(storage);

    const userId = randomUUID();
    const deviceId = randomUUID();

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
          INSERT INTO devices (
            id,
            user_id,
            platform,
            name
          )
          VALUES ($1, $2, $3, $4)
        `,
        [deviceId, userId, "test", "session-family-test"],
      );

      const firstSession = await repository.createSession({
        userId,
        deviceId,
        refreshTokenHash: `first-${randomUUID()}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        idleExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      const firstRotated = await repository.rotateSession(firstSession.id, {
        userId,
        deviceId,
        refreshTokenHash: `first-replacement-${randomUUID()}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        idleExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      const secondSession = await repository.createSession({
        userId,
        deviceId,
        refreshTokenHash: `second-${randomUUID()}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        idleExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      expect(secondSession.tokenFamilyId).not.toBe(firstSession.tokenFamilyId);

      await repository.handleRefreshTokenReplay(firstSession.id, firstSession.tokenFamilyId);

      const replayed = await repository.findByRefreshTokenHash(firstSession.refreshTokenHash);

      expect(replayed?.status).toBe("replay_detected");

      const firstReplacement = await repository.findByRefreshTokenHash(
        firstRotated.replacementSession.refreshTokenHash,
      );

      expect(firstReplacement?.status).toBe("revoked");

      const unrelated = await repository.findByRefreshTokenHash(secondSession.refreshTokenHash);

      expect(unrelated?.status).toBe("active");
    } finally {
      await storage.query(
        `
          DELETE FROM devices
          WHERE id = $1
        `,
        [deviceId],
      );

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
