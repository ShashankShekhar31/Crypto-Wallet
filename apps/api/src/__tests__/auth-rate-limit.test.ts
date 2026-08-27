import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import {
  connectCacheClient,
  createCacheClient,
  disconnectCacheClient,
} from "@crypto-wallet/cache";

import { AuthRateLimiter } from "../identity/auth-rate-limit.js";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error(
    "REDIS_URL is required for auth rate limit tests",
  );
}

describe("AuthRateLimiter", () => {
  it("allows requests within the configured limit", async () => {
    const cacheClient = createCacheClient({
      url: redisUrl,
    });

    const limiter = new AuthRateLimiter(
      cacheClient,
    );

    const key = `test:auth-rate-limit:${randomUUID()}`;

    try {
      await connectCacheClient(cacheClient);

      const first = await limiter.check({
        key,
        limit: 3,
        windowSeconds: 60,
      });

      expect(first.allowed).toBe(true);
      expect(first.remaining).toBe(2);

      const second = await limiter.check({
        key,
        limit: 3,
        windowSeconds: 60,
      });

      expect(second.allowed).toBe(true);
      expect(second.remaining).toBe(1);
    } finally {
      await cacheClient.del(key);
      await disconnectCacheClient(cacheClient);
    }
  });

  it("blocks requests after the configured limit", async () => {
    const cacheClient = createCacheClient({
      url: redisUrl,
    });

    const limiter = new AuthRateLimiter(
      cacheClient,
    );

    const key = `test:auth-rate-limit:${randomUUID()}`;

    try {
      await connectCacheClient(cacheClient);

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const result = await limiter.check({
          key,
          limit: 3,
          windowSeconds: 60,
        });

        expect(result.allowed).toBe(true);
      }

      const blocked = await limiter.check({
        key,
        limit: 3,
        windowSeconds: 60,
      });

      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(
        blocked.retryAfterSeconds,
      ).toBeGreaterThan(0);
    } finally {
      await cacheClient.del(key);
      await disconnectCacheClient(cacheClient);
    }
  });

  it("keeps separate keys independently rate limited", async () => {
    const cacheClient = createCacheClient({
      url: redisUrl,
    });

    const limiter = new AuthRateLimiter(
      cacheClient,
    );

    const firstKey =
      `test:auth-rate-limit:${randomUUID()}`;

    const secondKey =
      `test:auth-rate-limit:${randomUUID()}`;

    try {
      await connectCacheClient(cacheClient);

      const first = await limiter.check({
        key: firstKey,
        limit: 1,
        windowSeconds: 60,
      });

      const second = await limiter.check({
        key: secondKey,
        limit: 1,
        windowSeconds: 60,
      });

      expect(first.allowed).toBe(true);
      expect(first.remaining).toBe(0);

      expect(second.allowed).toBe(true);
      expect(second.remaining).toBe(0);

      const blockedFirst =
        await limiter.check({
          key: firstKey,
          limit: 1,
          windowSeconds: 60,
        });

      expect(blockedFirst.allowed).toBe(false);
    } finally {
      await cacheClient.del(firstKey);
      await cacheClient.del(secondKey);
      await disconnectCacheClient(cacheClient);
    }
  });

  it("rejects invalid rate limit configuration", async () => {
    const cacheClient = createCacheClient({
      url: redisUrl,
    });

    const limiter = new AuthRateLimiter(
      cacheClient,
    );

    try {
      await connectCacheClient(cacheClient);

      await expect(
        limiter.check({
          key: "",
          limit: 3,
          windowSeconds: 60,
        }),
      ).rejects.toThrow(
        "Rate limit key is required",
      );

      await expect(
        limiter.check({
          key: "test:key",
          limit: 0,
          windowSeconds: 60,
        }),
      ).rejects.toThrow(
        "Rate limit must be greater than zero",
      );

      await expect(
        limiter.check({
          key: "test:key",
          limit: 3,
          windowSeconds: 0,
        }),
      ).rejects.toThrow(
        "Rate limit window must be greater than zero",
      );
    } finally {
      await disconnectCacheClient(cacheClient);
    }
  });
});
