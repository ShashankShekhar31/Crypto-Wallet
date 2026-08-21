import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const client = new Client({
  connectionString: databaseUrl,
});

type Migration = {
  version: number;
  file: string;
};

function parseMigration(file: string): Migration | null {
  const match = /^(\d+)_.*\.sql$/.exec(file);

  if (!match) {
    return null;
  }

  return {
    version: Number(match[1]),
    file,
  };
}

async function migrate(): Promise<void> {
  await client.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version BIGINT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsPath = join(process.cwd(), "migrations");

    const files = await readdir(migrationsPath);

    const migrations = files
      .map(parseMigration)
      .filter((migration): migration is Migration => migration !== null)
      .sort((a, b) => a.version - b.version);

    for (const migration of migrations) {
      const existing = await client.query(
        "SELECT version FROM schema_migrations WHERE version = $1",
        [migration.version],
      );

      if (existing.rowCount !== 0) {
        console.log(
          `Migration ${migration.version} already applied`,
        );
        continue;
      }

      const migrationPath = join(
        migrationsPath,
        migration.file,
      );

      const migrationSql = await readFile(
        migrationPath,
        "utf8",
      );

      await client.query(migrationSql);

      await client.query(
        "INSERT INTO schema_migrations (version) VALUES ($1)",
        [migration.version],
      );

      console.log(
        `Applied migration ${migration.version}: ${migration.file}`,
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

await migrate();