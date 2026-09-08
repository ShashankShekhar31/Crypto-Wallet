import { describe, expect, it } from "vitest";

import { createDAppPermission, hasDAppCapability, isPermissionBoundTo } from "../permissions.js";

describe("createDAppPermission", () => {
  it("creates a normalized permission", () => {
    const permission = createDAppPermission({
      origin: "https://EXAMPLE.COM/",
      accountId: "account-1",
      chain: "evm",
      capabilities: ["connect", "sign"],
      grantedAt: "2026-09-07T00:00:00.000Z",
    });

    expect(permission).toEqual({
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
      capabilities: ["connect", "sign"],
      grantedAt: "2026-09-07T00:00:00.000Z",
    });
  });

  it("removes duplicate capabilities", () => {
    const permission = createDAppPermission({
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
      capabilities: ["connect", "sign", "sign"],
    });

    expect(permission.capabilities).toEqual(["connect", "sign"]);
  });

  it("requires connect capability", () => {
    expect(() =>
      createDAppPermission({
        origin: "https://example.com",
        accountId: "account-1",
        chain: "evm",
        capabilities: ["sign"],
      }),
    ).toThrow("dApp permission must include connect capability");
  });

  it("requires an account ID", () => {
    expect(() =>
      createDAppPermission({
        origin: "https://example.com",
        accountId: " ",
        chain: "evm",
        capabilities: ["connect"],
      }),
    ).toThrow("Account ID is required");
  });

  it("defaults grantedAt when omitted", () => {
    const permission = createDAppPermission({
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
      capabilities: ["connect"],
    });

    expect(permission.grantedAt).toEqual(expect.any(String));
  });
});

describe("hasDAppCapability", () => {
  it("returns true for granted capability", () => {
    const permission = createDAppPermission({
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
      capabilities: ["connect", "sign"],
    });

    expect(hasDAppCapability(permission, "sign")).toBe(true);
  });

  it("returns false for ungranted capability", () => {
    const permission = createDAppPermission({
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
      capabilities: ["connect"],
    });

    expect(hasDAppCapability(permission, "sign")).toBe(false);
  });
});

describe("isPermissionBoundTo", () => {
  it("matches the exact origin, account, and chain", () => {
    const permission = createDAppPermission({
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
      capabilities: ["connect"],
    });

    expect(isPermissionBoundTo(permission, "https://EXAMPLE.COM/", "account-1", "evm")).toBe(true);
  });

  it("rejects a different origin", () => {
    const permission = createDAppPermission({
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
      capabilities: ["connect"],
    });

    expect(isPermissionBoundTo(permission, "https://evil.example.com", "account-1", "evm")).toBe(
      false,
    );
  });

  it("rejects a different account", () => {
    const permission = createDAppPermission({
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
      capabilities: ["connect"],
    });

    expect(isPermissionBoundTo(permission, "https://example.com", "account-2", "evm")).toBe(false);
  });

  it("rejects a different chain", () => {
    const permission = createDAppPermission({
      origin: "https://example.com",
      accountId: "account-1",
      chain: "evm",
      capabilities: ["connect"],
    });

    expect(isPermissionBoundTo(permission, "https://example.com", "account-1", "solana")).toBe(
      false,
    );
  });
});
