import {
  Pool,
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from "pg";

import type { Storage, StorageTransaction } from "./index.js";

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

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }

  async transaction<T>(
    callback: (transaction: StorageTransaction) => Promise<T>,
  ): Promise<T> {
    const client: PoolClient = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const transaction: StorageTransaction = {
        query: <R extends QueryResultRow = QueryResultRow>(
          text: string,
          values: unknown[] = [],
        ): Promise<QueryResult<R>> => {
          return client.query<R>(text, values);
        },
      };

      const result = await callback(transaction);

      await client.query("COMMIT");

      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original transaction error.
      }

      throw error;
    } finally {
      client.release();
    }
  }
}
