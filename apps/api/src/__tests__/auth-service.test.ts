import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PostgresStorage } from "@crypto-wallet/storage";

import { hashPassword } from "../identity/password.js";
import { AuthenticationService } from "../identity/auth-service.js";
import { DeviceRepository } from "../identity/device-repository.js";
import { IdentityRepository } from "../identity/repository.js";
import { SessionRepository } from "../identity/session-repository.js";
import { hashRefreshToken } from "../identity/token.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required for authentication service tests",
  );
}

describe("AuthenticationService", () => {
  it("authenticates with a valid password and creates a session", async () => {
    const storage = new PostgresStorage(databaseUrl);

    const identityRepository =
      new IdentityRepository(storage);

    const sessionRepository =
      new SessionRepository(storage);
    
    const deviceRepository =
      new DeviceRepository(storage);

    const authenticationService =
      new AuthenticationService(
        identityRepository,
        sessionRepository,
        deviceRepository,
      );

    const userId = randomUUID();
    const deviceId = randomUUID();
    const identityAccountId = randomUUID();
    const passwordCredentialId = randomUUID();

    const email =
      `auth-${randomUUID()}@example.com`;

    const password =
      "CorrectHorseBatteryStaple!123";

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
          "authentication-test",
        ],
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
          email,
        ],
      );

      const passwordHash =
        await hashPassword(password);

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
        [
          passwordCredentialId,
          identityAccountId,
          passwordHash,
        ],
      );

      const result =
        await authenticationService.authenticateWithPassword(
          {
            normalizedEmail: email,
            password,
            deviceId,
            expiresAt: new Date(
              Date.now() + 60 * 60 * 1000,
            ),
            idleExpiresAt: new Date(
              Date.now() + 15 * 60 * 1000,
            ),
          },
        );

      expect(result.identityAccount).toMatchObject({
        id: identityAccountId,
        userId,
        normalizedEmail: email,
        status: "active",
      });

      expect(result.session).toMatchObject({
        userId,
        deviceId,
        status: "active",
      });

      expect(result.refreshToken).toEqual(
        expect.any(String),
      );

      expect(result.refreshToken.length).toBeGreaterThan(
        0,
      );

      expect(
        result.session.refreshTokenHash,
      ).toBe(
        hashRefreshToken(result.refreshToken),
      );

      expect(
        result.session.refreshTokenHash,
      ).not.toBe(result.refreshToken);

      const storedSession =
        await sessionRepository.findByRefreshTokenHash(
          result.session.refreshTokenHash,
        );

      expect(storedSession).not.toBeNull();

      expect(storedSession?.id).toBe(
        result.session.id,
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

  it("rejects an incorrect password", async () => {
    const storage = new PostgresStorage(databaseUrl);

    const identityRepository =
      new IdentityRepository(storage);

    const sessionRepository =
      new SessionRepository(storage);

    const deviceRepository =
      new DeviceRepository(storage);

    const authenticationService =
      new AuthenticationService(
        identityRepository,
        sessionRepository,
        deviceRepository,
      );

    const userId = randomUUID();
    const identityAccountId = randomUUID();
    const passwordCredentialId = randomUUID();

    const email =
      `wrong-password-${randomUUID()}@example.com`;

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
          email,
        ],
      );

      const passwordHash =
        await hashPassword(
          "CorrectHorseBatteryStaple!123",
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
        [
          passwordCredentialId,
          identityAccountId,
          passwordHash,
        ],
      );

      await expect(
        authenticationService.authenticateWithPassword(
          {
            normalizedEmail: email,
            password: "WrongPassword!123",
            deviceId: randomUUID(),
            expiresAt: new Date(
              Date.now() + 60 * 60 * 1000,
            ),
            idleExpiresAt: new Date(
              Date.now() + 15 * 60 * 1000,
            ),
          },
        ),
      ).rejects.toThrow("Invalid credentials");
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

  it("rejects an unknown identity", async () => {
    const storage = new PostgresStorage(databaseUrl);

    const authenticationService =
      new AuthenticationService(
        new IdentityRepository(storage),
        new SessionRepository(storage),
        new DeviceRepository(storage),
      );

    try {
      await storage.connect();

      await expect(
        authenticationService.authenticateWithPassword(
          {
            normalizedEmail:
              `missing-${randomUUID()}@example.com`,
            password: "SomePassword!123",
            deviceId: randomUUID(),
            expiresAt: new Date(
              Date.now() + 60 * 60 * 1000,
            ),
            idleExpiresAt: new Date(
              Date.now() + 15 * 60 * 1000,
            ),
          },
        ),
      ).rejects.toThrow("Invalid credentials");
    } finally {
      await storage.disconnect();
    }
  });

  it("rejects a device belonging to another user", async () => {
  const storage =
    new PostgresStorage(databaseUrl);

  const identityRepository =
    new IdentityRepository(storage);

  const sessionRepository =
    new SessionRepository(storage);

  const deviceRepository =
    new DeviceRepository(storage);

  const authenticationService =
    new AuthenticationService(
      identityRepository,
      sessionRepository,
      deviceRepository,
    );

  const userId = randomUUID();
  const deviceOwnerUserId = randomUUID();
  const deviceId = randomUUID();
  const identityAccountId = randomUUID();
  const passwordCredentialId = randomUUID();

  const email =
    `device-owner-test-${randomUUID()}@example.com`;

  const password =
    "CorrectHorseBatteryStaple!123";

  try {
    await storage.connect();

    await storage.query(
      `
        INSERT INTO users (id)
        VALUES ($1), ($2)
      `,
      [userId, deviceOwnerUserId],
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
        "another-user-device",
      ],
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
        email,
      ],
    );

    const passwordHash =
      await hashPassword(password);

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
      [
        passwordCredentialId,
        identityAccountId,
        passwordHash,
      ],
    );

    await expect(
      authenticationService.authenticateWithPassword({
        normalizedEmail: email,
        password,
        deviceId,
        expiresAt: new Date(
          Date.now() + 60 * 60 * 1000,
        ),
        idleExpiresAt: new Date(
          Date.now() + 15 * 60 * 1000,
        ),
      }),
    ).rejects.toThrow("Invalid device");
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
      [userId, deviceOwnerUserId],
    );

    await storage.disconnect();
  }
});
  it("rejects a revoked device", async () => {
  const storage =
    new PostgresStorage(databaseUrl);

  const identityRepository =
    new IdentityRepository(storage);

  const sessionRepository =
    new SessionRepository(storage);

  const deviceRepository =
    new DeviceRepository(storage);

  const authenticationService =
    new AuthenticationService(
      identityRepository,
      sessionRepository,
      deviceRepository,
    );

  const userId = randomUUID();
  const deviceId = randomUUID();
  const identityAccountId = randomUUID();
  const passwordCredentialId = randomUUID();

  const email =
    `revoked-device-${randomUUID()}@example.com`;

  const password =
    "CorrectHorseBatteryStaple!123";

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
        email,
      ],
    );

    const passwordHash =
      await hashPassword(password);

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
      [
        passwordCredentialId,
        identityAccountId,
        passwordHash,
      ],
    );

    await expect(
      authenticationService.authenticateWithPassword({
        normalizedEmail: email,
        password,
        deviceId,
        expiresAt: new Date(
          Date.now() + 60 * 60 * 1000,
        ),
        idleExpiresAt: new Date(
          Date.now() + 15 * 60 * 1000,
        ),
      }),
    ).rejects.toThrow("Invalid device");
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
