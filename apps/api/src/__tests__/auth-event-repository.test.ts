import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PostgresStorage } from "@crypto-wallet/storage";

import { AuthEventRepository } from "../identity/auth-event-repository.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for auth event repository tests");
}

describe("AuthEventRepository", () => {
  it("records a successful authentication event", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new AuthEventRepository(storage);

    const userId = randomUUID();

    try {
      await storage.connect();

      await storage.query(
        `
          INSERT INTO users (id)
          VALUES ($1)
        `,
        [userId],
      );

      const event = await repository.record({
        userId,
        eventType: "password_login",
        outcome: "success",
      });

      expect(event).toMatchObject({
        userId,
        deviceId: null,
        sessionId: null,
        eventType: "password_login",
        outcome: "success",
        sourceIpHash: null,
        userAgent: null,
        failureCode: null,
      });

      expect(event.id).toEqual(expect.any(String));

      expect(event.occurredAt).toBeInstanceOf(Date);
    } finally {
      await storage.query(
        `
          DELETE FROM auth_events
          WHERE user_id = $1
        `,
        [userId],
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

  it("records a failed authentication event with failure metadata", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new AuthEventRepository(storage);

    try {
      await storage.connect();

      const event = await repository.record({
        eventType: "password_login",
        outcome: "failure",
        sourceIpHash: "ip-hash-test",
        userAgent: "test-agent",
        failureCode: "invalid_credentials",
      });

      expect(event).toMatchObject({
        userId: null,
        deviceId: null,
        sessionId: null,
        eventType: "password_login",
        outcome: "failure",
        sourceIpHash: "ip-hash-test",
        userAgent: "test-agent",
        failureCode: "invalid_credentials",
      });

      expect(event.id).toEqual(expect.any(String));

      expect(event.occurredAt).toBeInstanceOf(Date);

      await storage.query(
        `
          DELETE FROM auth_events
          WHERE id = $1
        `,
        [event.id],
      );
    } finally {
      await storage.disconnect();
    }
  });

  it("records a blocked authentication event", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new AuthEventRepository(storage);

    try {
      await storage.connect();

      const event = await repository.record({
        eventType: "password_login",
        outcome: "blocked",
        failureCode: "password_locked",
      });

      expect(event).toMatchObject({
        eventType: "password_login",
        outcome: "blocked",
        failureCode: "password_locked",
      });

      await storage.query(
        `
          DELETE FROM auth_events
          WHERE id = $1
        `,
        [event.id],
      );
    } finally {
      await storage.disconnect();
    }
  });

  it("records a suspicious authentication event", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new AuthEventRepository(storage);

    try {
      await storage.connect();

      const event = await repository.record({
        eventType: "login_detection",
        outcome: "suspicious",
        sourceIpHash: "suspicious-ip-hash",
        userAgent: "suspicious-agent",
        failureCode: "unusual_login",
      });

      expect(event).toMatchObject({
        eventType: "login_detection",
        outcome: "suspicious",
        sourceIpHash: "suspicious-ip-hash",
        userAgent: "suspicious-agent",
        failureCode: "unusual_login",
      });

      await storage.query(
        `
          DELETE FROM auth_events
          WHERE id = $1
        `,
        [event.id],
      );
    } finally {
      await storage.disconnect();
    }
  });

  it("associates an event with a user and device", async () => {
    const storage = new PostgresStorage(databaseUrl);
    const repository = new AuthEventRepository(storage);

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
        [deviceId, userId, "test", "auth-event-repository-test"],
      );

      const event = await repository.record({
        userId,
        deviceId,
        eventType: "password_login",
        outcome: "success",
      });

      expect(event).toMatchObject({
        userId,
        deviceId,
        sessionId: null,
        eventType: "password_login",
        outcome: "success",
      });

      await storage.query(
        `
          DELETE FROM auth_events
          WHERE id = $1
        `,
        [event.id],
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
