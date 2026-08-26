import {
  createClient,
  type RedisClientType,
} from "redis";

export interface CacheClientOptions {
  url: string;
}

export type CacheClient = RedisClientType;

export function createCacheClient(
  options: CacheClientOptions,
): CacheClient {
  return createClient({
    url: options.url,
  });
}

export async function connectCacheClient(
  client: CacheClient,
): Promise<void> {
  if (!client.isOpen) {
    await client.connect();
  }
}

export async function disconnectCacheClient(
  client: CacheClient,
): Promise<void> {
  if (client.isOpen) {
    await client.quit();
  }
}