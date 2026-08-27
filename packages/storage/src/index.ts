import type { QueryResult, QueryResultRow } from "pg";

export interface StorageTransaction {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>>;
}

export interface Storage {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<boolean>;

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>>;

  transaction<T>(callback: (transaction: StorageTransaction) => Promise<T>): Promise<T>;
}

export { PostgresStorage } from "./postgres.js";
