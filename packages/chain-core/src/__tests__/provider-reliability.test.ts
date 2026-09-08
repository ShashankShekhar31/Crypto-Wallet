import { describe, expect, it, vi } from "vitest";

import { ProviderPool, ProviderReliabilityError } from "../provider-reliability.js";

describe("ProviderPool", () => {
  it("uses the healthiest provider first", async () => {
    const pool = new ProviderPool(
      [
        { id: "primary", provider: "primary" },
        { id: "backup", provider: "backup" },
      ],
      {
        timeoutMs: 100,
        failureThreshold: 3,
        recoveryTimeoutMs: 1_000,
      },
    );

    const result = await pool.execute(async (provider) => provider);

    expect(result).toBe("primary");
  });

  it("fails over when the primary provider fails", async () => {
    const calls: string[] = [];

    const pool = new ProviderPool(
      [
        { id: "primary", provider: "primary" },
        { id: "backup", provider: "backup" },
      ],
      {
        timeoutMs: 100,
        failureThreshold: 3,
        recoveryTimeoutMs: 1_000,
      },
    );

    const result = await pool.execute(async (provider) => {
      calls.push(provider);

      if (provider === "primary") {
        throw new Error("primary unavailable");
      }

      return "success";
    });

    expect(result).toBe("success");
    expect(calls).toEqual(["primary", "backup"]);

    const health = pool.getHealth();

    expect(health[0]).toMatchObject({
      id: "primary",
      consecutiveFailures: 1,
      totalFailures: 1,
      score: 75,
      circuitState: "closed",
    });

    expect(health[1]).toMatchObject({
      id: "backup",
      consecutiveFailures: 0,
      totalFailures: 0,
      score: 100,
      circuitState: "closed",
    });
  });

  it("opens the circuit after the configured failure threshold", async () => {
    const pool = new ProviderPool([{ id: "primary", provider: "primary" }], {
      timeoutMs: 100,
      failureThreshold: 2,
      recoveryTimeoutMs: 1_000,
    });

    await expect(
      pool.execute(async () => {
        throw new Error("primary unavailable");
      }),
    ).rejects.toBeInstanceOf(ProviderReliabilityError);

    await expect(
      pool.execute(async () => {
        throw new Error("primary unavailable");
      }),
    ).rejects.toBeInstanceOf(ProviderReliabilityError);

    expect(pool.getHealth()).toContainEqual(
      expect.objectContaining({
        id: "primary",
        circuitState: "open",
        consecutiveFailures: 2,
        totalFailures: 2,
      }),
    );
  });

  it("does not use an open circuit until recovery timeout expires", async () => {
    vi.useFakeTimers();

    try {
      const calls: string[] = [];

      const pool = new ProviderPool([{ id: "primary", provider: "primary" }], {
        timeoutMs: 10_000,
        failureThreshold: 1,
        recoveryTimeoutMs: 1_000,
      });

      await expect(
        pool.execute(async () => {
          calls.push("primary");
          throw new Error("failure");
        }),
      ).rejects.toBeInstanceOf(ProviderReliabilityError);

      expect(calls).toEqual(["primary"]);

      await vi.advanceTimersByTimeAsync(999);

      await expect(
        pool.execute(async () => {
          calls.push("primary");
          return "unexpected";
        }),
      ).rejects.toThrow("All RPC providers are unavailable");

      expect(calls).toEqual(["primary"]);

      await vi.advanceTimersByTimeAsync(1);

      const result = await pool.execute(async () => {
        calls.push("primary");
        return "recovered";
      });

      expect(result).toBe("recovered");
      expect(calls).toEqual(["primary", "primary"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("marks a successful half-open probe as healthy", async () => {
    vi.useFakeTimers();

    try {
      const pool = new ProviderPool([{ id: "primary", provider: "primary" }], {
        timeoutMs: 100,
        failureThreshold: 1,
        recoveryTimeoutMs: 1_000,
      });

      await expect(
        pool.execute(async () => {
          throw new Error("failure");
        }),
      ).rejects.toBeInstanceOf(ProviderReliabilityError);

      vi.advanceTimersByTime(1_000);

      await expect(pool.execute(async () => "success")).resolves.toBe("success");

      expect(pool.getHealth()).toContainEqual(
        expect.objectContaining({
          id: "primary",
          score: 85,
          consecutiveFailures: 0,
          circuitState: "closed",
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails over when a provider times out", async () => {
    const pool = new ProviderPool(
      [
        { id: "slow", provider: "slow" },
        { id: "backup", provider: "backup" },
      ],
      {
        timeoutMs: 10,
        failureThreshold: 3,
        recoveryTimeoutMs: 1_000,
      },
    );

    const result = await pool.execute(async (provider) => {
      if (provider === "slow") {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      return provider;
    });

    expect(result).toBe("backup");

    expect(pool.getHealth()).toContainEqual(
      expect.objectContaining({
        id: "slow",
        totalFailures: 1,
        consecutiveFailures: 1,
        score: 75,
      }),
    );
  });

  it("rejects when no provider is configured", () => {
    expect(() => new ProviderPool([])).toThrow("At least one provider is required");
  });

  it("rejects duplicate provider ids", () => {
    expect(
      () =>
        new ProviderPool([
          { id: "duplicate", provider: "one" },
          { id: "duplicate", provider: "two" },
        ]),
    ).toThrow("Duplicate provider id: duplicate");
  });

  it("rejects invalid reliability options", () => {
    expect(
      () =>
        new ProviderPool([{ id: "primary", provider: "primary" }], {
          timeoutMs: 0,
        }),
    ).toThrow("Provider timeout must be positive");

    expect(
      () =>
        new ProviderPool([{ id: "primary", provider: "primary" }], {
          failureThreshold: 0,
        }),
    ).toThrow("Provider failure threshold must be a positive integer");

    expect(
      () =>
        new ProviderPool([{ id: "primary", provider: "primary" }], {
          recoveryTimeoutMs: 0,
        }),
    ).toThrow("Provider recovery timeout must be positive");
  });
  it("reopens the circuit when a half-open probe fails", async () => {
    vi.useFakeTimers();

    try {
      const pool = new ProviderPool([{ id: "primary", provider: "primary" }], {
        timeoutMs: 100,
        failureThreshold: 1,
        recoveryTimeoutMs: 1_000,
      });

      await expect(
        pool.execute(async () => {
          throw new Error("initial failure");
        }),
      ).rejects.toBeInstanceOf(ProviderReliabilityError);

      expect(pool.getHealth()).toContainEqual(
        expect.objectContaining({
          id: "primary",
          circuitState: "open",
        }),
      );

      vi.advanceTimersByTime(1_000);

      await expect(
        pool.execute(async () => {
          throw new Error("probe failure");
        }),
      ).rejects.toBeInstanceOf(ProviderReliabilityError);

      expect(pool.getHealth()).toContainEqual(
        expect.objectContaining({
          id: "primary",
          circuitState: "open",
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });
  it("rejects when all providers fail", async () => {
    const calls: string[] = [];

    const pool = new ProviderPool(
      [
        { id: "primary", provider: "primary" },
        { id: "backup", provider: "backup" },
        { id: "tertiary", provider: "tertiary" },
      ],
      {
        timeoutMs: 100,
        failureThreshold: 3,
        recoveryTimeoutMs: 1_000,
      },
    );

    await expect(
      pool.execute(async (provider) => {
        calls.push(provider);
        throw new Error(`${provider} unavailable`);
      }),
    ).rejects.toBeInstanceOf(ProviderReliabilityError);

    expect(calls).toEqual(["primary", "backup", "tertiary"]);

    expect(pool.getHealth()).toEqual([
      expect.objectContaining({
        id: "primary",
        totalRequests: 1,
        totalFailures: 1,
        consecutiveFailures: 1,
        score: 75,
      }),
      expect.objectContaining({
        id: "backup",
        totalRequests: 1,
        totalFailures: 1,
        consecutiveFailures: 1,
        score: 75,
      }),
      expect.objectContaining({
        id: "tertiary",
        totalRequests: 1,
        totalFailures: 1,
        consecutiveFailures: 1,
        score: 75,
      }),
    ]);
  });
});
