import { describe, expect, it } from "vitest";

import { connectCacheClient, createCacheClient, disconnectCacheClient } from "../index.js";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is required for cache tests");
}

describe("CacheClient", () => {
  it("connects and disconnects cleanly", async () => {
    const client = createCacheClient({
      url: redisUrl,
    });

    try {
      expect(client.isOpen).toBe(false);

      await connectCacheClient(client);

      expect(client.isOpen).toBe(true);
    } finally {
      await disconnectCacheClient(client);
    }

    expect(client.isOpen).toBe(false);
  });
});
