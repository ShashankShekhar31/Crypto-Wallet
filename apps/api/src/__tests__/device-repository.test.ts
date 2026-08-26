import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PostgresStorage } from "@crypto-wallet/storage";

import { DeviceRepository } from "../identity/device-repository.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required for device repository tests",
  );
}

describe("DeviceRepository", () => {
  it("finds an active device belonging to the user", async () => {
    const storage =
      new PostgresStorage(databaseUrl);

    const repository =
      new DeviceRepository(storage);

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
        [
          deviceId,
          userId,
          "test",
          "device-repository-test",
        ],
      );

      const device =
        await repository.findActiveDeviceForUser(
          deviceId,
          userId,
        );

      expect(device).not.toBeNull();

      expect(device).toMatchObject({
        id: deviceId,
        userId,
        platform: "test",
        name: "device-repository-test",
        revokedAt: null,
      });

      expect(device?.createdAt).toBeInstanceOf(
        Date,
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

  it("returns null when the device belongs to another user", async () => {
    const storage =
      new PostgresStorage(databaseUrl);

    const repository =
      new DeviceRepository(storage);

    const deviceOwnerUserId = randomUUID();
    const requestingUserId = randomUUID();
    const deviceId = randomUUID();

    try {
      await storage.connect();

      await storage.query(
        `
          INSERT INTO users (id)
          VALUES ($1), ($2)
        `,
        [
          deviceOwnerUserId,
          requestingUserId,
        ],
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
          deviceOwnerUserId,
          "test",
          "foreign-device",
        ],
      );

      const device =
        await repository.findActiveDeviceForUser(
          deviceId,
          requestingUserId,
        );

      expect(device).toBeNull();
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
          WHERE id IN ($1, $2)
        `,
        [
          deviceOwnerUserId,
          requestingUserId,
        ],
      );

      await storage.disconnect();
    }
  });

  it("returns null when the device is revoked", async () => {
    const storage =
      new PostgresStorage(databaseUrl);

    const repository =
      new DeviceRepository(storage);

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
            name,
            revoked_at
          )
          VALUES ($1, $2, $3, $4, NOW())
        `,
        [
          deviceId,
          userId,
          "test",
          "revoked-device",
        ],
      );

      const device =
        await repository.findActiveDeviceForUser(
          deviceId,
          userId,
        );

      expect(device).toBeNull();
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

  it("returns null when the device does not exist", async () => {
    const storage =
      new PostgresStorage(databaseUrl);

    const repository =
      new DeviceRepository(storage);

    try {
      await storage.connect();

      const device =
        await repository.findActiveDeviceForUser(
          randomUUID(),
          randomUUID(),
        );

      expect(device).toBeNull();
    } finally {
      await storage.disconnect();
    }
  });
});