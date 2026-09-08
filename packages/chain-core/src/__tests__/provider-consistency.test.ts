import { describe, expect, it } from "vitest";

import { ProviderConsistencyChecker, type ConsistencyProvider } from "../provider-consistency.js";

describe("ProviderConsistencyChecker", () => {
  it("accepts matching critical data", async () => {
    const primary: ConsistencyProvider<string> = {
      id: "primary",
      async get() {
        return "block-hash-100";
      },
    };

    const secondary: ConsistencyProvider<string> = {
      id: "secondary",
      async get() {
        return "block-hash-100";
      },
    };

    const checker = new ProviderConsistencyChecker<string>();

    await expect(checker.check(primary, secondary)).resolves.toEqual({
      consistent: true,
      primaryProviderId: "primary",
      secondaryProviderId: "secondary",
      primaryValue: "block-hash-100",
      secondaryValue: "block-hash-100",
    });
  });

  it("detects mismatched critical data", async () => {
    const primary: ConsistencyProvider<string> = {
      id: "primary",
      async get() {
        return "block-hash-A";
      },
    };

    const secondary: ConsistencyProvider<string> = {
      id: "secondary",
      async get() {
        return "block-hash-B";
      },
    };

    const checker = new ProviderConsistencyChecker<string>();

    await expect(checker.check(primary, secondary)).resolves.toEqual({
      consistent: false,
      primaryProviderId: "primary",
      secondaryProviderId: "secondary",
      primaryValue: "block-hash-A",
      secondaryValue: "block-hash-B",
      reason: "Provider values do not match",
    });
  });

  it("supports custom equality for structured data", async () => {
    const primary: ConsistencyProvider<{ height: number; hash: string }> = {
      id: "primary",
      async get() {
        return {
          height: 100,
          hash: "abc",
        };
      },
    };

    const secondary: ConsistencyProvider<{ height: number; hash: string }> = {
      id: "secondary",
      async get() {
        return {
          height: 100,
          hash: "abc",
        };
      },
    };

    const checker = new ProviderConsistencyChecker<{
      height: number;
      hash: string;
    }>({
      equals: (left, right) => left.height === right.height && left.hash === right.hash,
    });

    await expect(checker.check(primary, secondary)).resolves.toMatchObject({
      consistent: true,
    });
  });

  it("rejects the same provider on both sides", async () => {
    const provider: ConsistencyProvider<string> = {
      id: "primary",
      async get() {
        return "value";
      },
    };

    const checker = new ProviderConsistencyChecker<string>();

    await expect(checker.check(provider, provider)).rejects.toThrow(
      "Consistency providers must be different",
    );
  });

  it("rejects an empty provider id", async () => {
    const invalid: ConsistencyProvider<string> = {
      id: " ",
      async get() {
        return "value";
      },
    };

    const valid: ConsistencyProvider<string> = {
      id: "secondary",
      async get() {
        return "value";
      },
    };

    const checker = new ProviderConsistencyChecker<string>();

    await expect(checker.check(invalid, valid)).rejects.toThrow("Primary provider id is required");
  });
});
