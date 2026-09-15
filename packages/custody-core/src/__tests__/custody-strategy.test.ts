import { describe, expect, it } from "vitest";
import { CUSTODY_TIER_POLICIES, getCustodyTierPolicy } from "../custody-strategy.js";

describe("custody tier strategy", () => {
  it("defines hot, warm, and cold custody tiers", () => {
    expect(Object.keys(CUSTODY_TIER_POLICIES).sort()).toEqual(["cold", "hot", "warm"]);
  });

  it("allows hot wallets for frequent operational signing", () => {
    const policy = getCustodyTierPolicy("hot");

    expect(policy.requiresManualAuthorization).toBe(false);
    expect(policy.requiresMultipleApprovers).toBe(false);
  });

  it("requires stronger authorization for warm wallets", () => {
    const policy = getCustodyTierPolicy("warm");

    expect(policy.requiresManualAuthorization).toBe(true);
    expect(policy.requiresMultipleApprovers).toBe(true);
  });

  it("requires stronger authorization for cold wallets", () => {
    const policy = getCustodyTierPolicy("cold");

    expect(policy.requiresManualAuthorization).toBe(true);
    expect(policy.requiresMultipleApprovers).toBe(true);
  });

  it("returns immutable policy definitions", () => {
    expect(Object.isFrozen(CUSTODY_TIER_POLICIES)).toBe(true);
    expect(Object.isFrozen(CUSTODY_TIER_POLICIES.hot)).toBe(true);
    expect(Object.isFrozen(CUSTODY_TIER_POLICIES.warm)).toBe(true);
    expect(Object.isFrozen(CUSTODY_TIER_POLICIES.cold)).toBe(true);
  });
});
