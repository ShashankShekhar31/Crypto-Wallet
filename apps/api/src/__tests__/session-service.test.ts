import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PostgresStorage } from "@crypto-wallet/storage";

import { SessionService } from "../identity/session-service.js";
import { SessionRepository } from "../identity/session-repository.js";
import {
  generateRefreshToken,
  hashRefreshToken,
} from "../identity/token.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required for session service tests",
  );
}

describe("SessionService", () => {
  it("refreshes an active session and rotates the refresh token", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository =
      new SessionRepository(storage);
    const service =
      new SessionService(repository);

    const userId = randomUUID();
    const deviceId = randomUUID();

    const refreshToken =
      generateRefreshToken();

    const expiresAt = new Date(
      Date.now() + 60 * 60 * 1000,
    );

    const idleExpiresAt = new Date(
      Date.now() + 15 * 60 * 1000,
    );

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
        [
          deviceId,
          userId,
          "test",
          "session-service-test",
        ],
      );

      const original =
        await repository.createSession({
          userId,
          deviceId,
          refreshTokenHash:
            hashRefreshToken(refreshToken),
          expiresAt,
          idleExpiresAt,
        });

      const result =
        await service.refresh({
          refreshToken,
          idleTimeoutMs:
            15 * 60 * 1000,
        });

      expect(
        result.previousSession,
      ).toMatchObject({
        id: original.id,
        status: "rotated",
        tokenFamilyId:
          original.tokenFamilyId,
        replacedBySessionId:
          result.session.id,
      });

      expect(result.session).toMatchObject({
        userId,
        deviceId,
        status: "active",
        tokenFamilyId:
          original.tokenFamilyId,
      });

      expect(result.refreshToken).toEqual(
        expect.any(String),
      );

      expect(result.refreshToken).not.toBe(
        refreshToken,
      );

      expect(
        result.session.refreshTokenHash,
      ).toBe(
        hashRefreshToken(
          result.refreshToken,
        ),
      );

      expect(
        result.session.expiresAt.getTime(),
      ).toBe(expiresAt.getTime());

      expect(
        result.session.idleExpiresAt.getTime(),
      ).toBeGreaterThan(
        original.idleExpiresAt.getTime(),
      );
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

  it("rejects an unknown refresh token", async () => {
    const storage =
      new PostgresStorage(databaseUrl);

    const service = new SessionService(
      new SessionRepository(storage),
    );

    try {
      await storage.connect();

      await expect(
        service.refresh({
          refreshToken:
            generateRefreshToken(),
          idleTimeoutMs:
            15 * 60 * 1000,
        }),
      ).rejects.toThrow(
        "Invalid refresh token",
      );
    } finally {
      await storage.disconnect();
    }
  });

  it("rejects a rotated refresh token", async () => {
    const storage =
      new PostgresStorage(databaseUrl);

    const repository =
      new SessionRepository(storage);

    const service =
      new SessionService(repository);

    const userId = randomUUID();
    const deviceId = randomUUID();

    const refreshToken =
      generateRefreshToken();

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
        [
          deviceId,
          userId,
          "test",
          "session-service-test",
        ],
      );

      await repository.createSession({
        userId,
        deviceId,
        refreshTokenHash:
          hashRefreshToken(refreshToken),
        expiresAt: new Date(
          Date.now() + 60 * 60 * 1000,
        ),
        idleExpiresAt: new Date(
          Date.now() + 15 * 60 * 1000,
        ),
      });

      const refreshed =
        await service.refresh({
          refreshToken,
          idleTimeoutMs:
            15 * 60 * 1000,
        });

      await expect(
        service.refresh({
          refreshToken,
          idleTimeoutMs:
            15 * 60 * 1000,
        }),
      ).rejects.toThrow(
        "Refresh token replay detected",
      );

      const replacement =
        await repository.findByRefreshTokenHash(
          hashRefreshToken(
            refreshed.refreshToken,
          ),
        );

      expect(replacement).not.toBeNull();

      expect(replacement).toMatchObject({
        id: refreshed.session.id,
        status: "revoked",
        tokenFamilyId:
          refreshed.session.tokenFamilyId,
        revokedReason:
          "refresh_token_replay",
      });

      expect(
        replacement?.revokedAt,
      ).toBeInstanceOf(Date);

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

  it("rejects an expired session", async () => {
  const storage =
    new PostgresStorage(databaseUrl);

  const repository =
    new SessionRepository(storage);

  const service =
    new SessionService(repository);

  const userId = randomUUID();
  const deviceId = randomUUID();

  const refreshToken =
    generateRefreshToken();

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
      [
        deviceId,
        userId,
        "test",
        "session-service-test",
      ],
    );

    const session =
      await repository.createSession({
        userId,
        deviceId,
        refreshTokenHash:
          hashRefreshToken(refreshToken),
        expiresAt: new Date(
          Date.now() + 60 * 60 * 1000,
        ),
        idleExpiresAt: new Date(
          Date.now() + 30 * 60 * 1000,
        ),
      });

    await storage.query(
      `
        UPDATE auth_sessions
        SET
            issued_at = NOW() - INTERVAL '2 minutes',
            expires_at = NOW() - INTERVAL '1 second'
        WHERE id = $1
      `,
      [session.id],
    );

    await expect(
      service.refresh({
        refreshToken,
        idleTimeoutMs:
          15 * 60 * 1000,
      }),
    ).rejects.toThrow(
      "Auth session has expired",
    );
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

it("rejects an idle-expired session", async () => {
  const storage =
    new PostgresStorage(databaseUrl);

  const repository =
    new SessionRepository(storage);

  const service =
    new SessionService(repository);

  const userId = randomUUID();
  const deviceId = randomUUID();

  const refreshToken =
    generateRefreshToken();

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
      [
        deviceId,
        userId,
        "test",
        "session-service-test",
      ],
    );

    const session =
      await repository.createSession({
        userId,
        deviceId,
        refreshTokenHash:
          hashRefreshToken(refreshToken),
        expiresAt: new Date(
          Date.now() + 60 * 60 * 1000,
        ),
        idleExpiresAt: new Date(
          Date.now() + 30 * 60 * 1000,
        ),
      });

    await storage.query(
      `
        UPDATE auth_sessions
        SET
          issued_at = NOW() - INTERVAL '2 hours',
          last_seen_at = NOW() - INTERVAL '30 minutes',
          idle_expires_at = NOW() - INTERVAL '1 second'
        WHERE id = $1
      `,
      [session.id],
    );

    await expect(
      service.refresh({
        refreshToken,
        idleTimeoutMs:
          15 * 60 * 1000,
      }),
    ).rejects.toThrow(
      "Auth session is idle-expired",
    );
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