import { Pool } from "pg";
import type { Storage } from "./index.js";

export class PostgresStorage implements Storage {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
    });
  }

  async connect(): Promise<void> {
    await this.pool.query("SELECT 1");
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }
}