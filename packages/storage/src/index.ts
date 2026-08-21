export interface Storage {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<boolean>;
}

export { PostgresStorage } from "./postgres.js";
