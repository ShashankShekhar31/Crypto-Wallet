import { randomUUID } from "node:crypto";

import { PostgresStorage } from "@crypto-wallet/storage";

import { hashPassword } from "../src/identity/password.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const email = process.env.K6_AUTH_EMAIL ?? `k6-performance-${randomUUID()}@example.com`;

const password = process.env.K6_AUTH_PASSWORD;

if (!password) {
  throw new Error("K6_AUTH_PASSWORD is required");
}

const userId = randomUUID();
const deviceId = randomUUID();
const identityAccountId = randomUUID();
const passwordCredentialId = randomUUID();

const storage = new PostgresStorage(databaseUrl);

try {
  await storage.connect();

  const passwordHash = await hashPassword(password);

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
    [deviceId, userId, "test", "k6-performance"],
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
    [passwordCredentialId, identityAccountId, passwordHash],
  );

  console.log("");
  console.log("Performance identity created successfully.");
  console.log("");
  console.log(`K6_AUTH_EMAIL=${email}`);
  console.log(`K6_AUTH_PASSWORD=${password}`);
  console.log(`K6_AUTH_DEVICE_ID=${deviceId}`);
  console.log("");
  console.log(`USER_ID=${userId}`);
  console.log(`DEVICE_ID=${deviceId}`);
  console.log("");
} finally {
  await storage.disconnect();
}
