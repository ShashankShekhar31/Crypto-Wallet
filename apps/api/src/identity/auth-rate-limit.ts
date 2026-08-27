import type { CacheClient } from "@crypto-wallet/cache";

export interface AuthRateLimitInput {
  key: string;
  limit: number;
  windowSeconds: number;
}

export interface AuthRateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class AuthRateLimiter {
  constructor(
    private readonly cacheClient: CacheClient,
  ) {}

  async check(
    input: AuthRateLimitInput,
  ): Promise<AuthRateLimitResult> {
    if (input.key.trim() === "") {
      throw new Error("Rate limit key is required");
    }

    if (input.limit <= 0) {
      throw new Error("Rate limit must be greater than zero");
    }

    if (input.windowSeconds <= 0) {
      throw new Error(
        "Rate limit window must be greater than zero",
      );
    }

    const count = await this.cacheClient.incr(
      input.key,
    );

    if (count === 1) {
      await this.cacheClient.expire(
        input.key,
        input.windowSeconds,
      );
    }

    const remaining = Math.max(
      0,
      input.limit - count,
    );

    const allowed = count <= input.limit;

    const ttl =
      await this.cacheClient.ttl(input.key);

    return {
      allowed,
      remaining,
      retryAfterSeconds: Math.max(0, ttl),
    };
  }
}
