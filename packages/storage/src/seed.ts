import { randomUUID } from "node:crypto";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const client = new Client({
  connectionString: databaseUrl,
});

const fixture = {
  userId: "00000000-0000-4000-8000-000000000001",
  walletId: "00000000-0000-4000-8000-000000000002",
  deviceId: "00000000-0000-4000-8000-000000000003",
  accountId: "00000000-0000-4000-8000-000000000004",
  networkId: "00000000-0000-4000-8000-000000000005",
  assetId: "00000000-0000-4000-8000-000000000006",
  addressId: "00000000-0000-4000-8000-000000000007",
  transactionId: "00000000-0000-4000-8000-000000000008",
};

async function seed(): Promise<void> {
  await client.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
        INSERT INTO users (id)
        VALUES ($1)
        ON CONFLICT (id) DO NOTHING
      `,
      [fixture.userId],
    );

    await client.query(
      `
        INSERT INTO wallets (id, user_id, name)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO NOTHING
      `,
      [fixture.walletId, fixture.userId, "Day 6 Test Wallet"],
    );

    await client.query(
      `
        INSERT INTO devices (id, user_id, platform, name)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO NOTHING
      `,
      [
        fixture.deviceId,
        fixture.userId,
        "test",
        "Day 6 Test Device",
      ],
    );

    await client.query(
      `
        INSERT INTO accounts (id, wallet_id, name, account_index)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO NOTHING
      `,
      [
        fixture.accountId,
        fixture.walletId,
        "Primary Test Account",
        0,
      ],
    );

    await client.query(
      `
        INSERT INTO networks (
          id,
          key,
          name,
          chain,
          environment,
          chain_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO NOTHING
      `,
      [
        fixture.networkId,
        "test-network",
        "Test Network",
        "test-chain",
        "development",
        999999,
      ],
    );

    await client.query(
      `
        INSERT INTO assets (
          id,
          network_id,
          symbol,
          name,
          decimals,
          asset_type
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO NOTHING
      `,
      [
        fixture.assetId,
        fixture.networkId,
        "TST",
        "Test Asset",
        18,
        "native",
      ],
    );

    await client.query(
      `
        INSERT INTO addresses (
          id,
          account_id,
          network_id,
          address,
          derivation_index,
          is_change
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO NOTHING
      `,
      [
        fixture.addressId,
        fixture.accountId,
        fixture.networkId,
        "test-address-0001",
        0,
        false,
      ],
    );

    await client.query(
      `
        INSERT INTO transactions (
          id,
          account_id,
          network_id,
          asset_id,
          tx_hash,
          idempotency_key,
          direction,
          status,
          amount,
          fee_amount
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING
      `,
      [
        fixture.transactionId,
        fixture.accountId,
        fixture.networkId,
        fixture.assetId,
        `test-tx-${randomUUID()}`,
        "day6-test-transaction-001",
        "outgoing",
        "pending",
        "1000000000000000000",
        "1000000000000000",
      ],
    );

    await client.query("COMMIT");

    console.log("Day 6 database seed completed successfully.");
    console.log("Fixture IDs:");
    console.log(fixture);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

await seed();
