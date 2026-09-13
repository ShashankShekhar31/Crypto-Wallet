import { describe, expect, it } from "vitest";
import {
  ExchangeAccountRegistry,
  type ExchangeAccountRecord,
} from "../index.js";

function createAccount(
  overrides: Partial<ExchangeAccountRecord> = {},
): ExchangeAccountRecord {
  return {
    id: "exchange-account-1",
    ownerType: "customer",
    ownerId: "customer-1",
    kind: "customer",
    status: "active",
    createdAt: "2026-09-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("ExchangeAccountRegistry", () => {
  it("creates and retrieves an exchange account", () => {
    const registry = new ExchangeAccountRegistry();
    const account = createAccount();

    const created = registry.create(account);

    expect(created).toEqual(account);
    expect(registry.getById(account.id)).toEqual(account);
  });

  it("rejects duplicate account IDs", () => {
    const registry = new ExchangeAccountRegistry();

    registry.create(createAccount());

    expect(() =>
      registry.create(createAccount({ ownerId: "customer-2" })),
    ).toThrow("Exchange account already exists");
  });

  it("rejects duplicate owner and account kind", () => {
    const registry = new ExchangeAccountRegistry();

    registry.create(createAccount());

    expect(() =>
      registry.create(createAccount({ id: "exchange-account-2" })),
    ).toThrow(
      "Exchange account already exists for owner and account kind",
    );
  });

  it("returns null for an unknown account", () => {
    const registry = new ExchangeAccountRegistry();

    expect(registry.getById("unknown")).toBeNull();
  });

  it("returns an immutable account", () => {
    const registry = new ExchangeAccountRegistry();

    const created = registry.create(createAccount());

    expect(() => {
      created.status = "blocked";
    }).toThrow();

    expect(registry.getById(created.id)?.status).toBe("active");
  });

  it("rejects an empty owner ID", () => {
    const registry = new ExchangeAccountRegistry();

    expect(() =>
      registry.create(createAccount({ ownerId: "   " })),
    ).toThrow("Exchange account owner ID must not be empty");
  });

  it("rejects customer-owned non-customer accounts", () => {
    const registry = new ExchangeAccountRegistry();

    expect(() =>
      registry.create(
        createAccount({
          kind: "fee",
        }),
      ),
    ).toThrow(
      "Customer-owned exchange accounts must have customer kind",
    );
  });

  it("rejects platform-owned customer accounts", () => {
    const registry = new ExchangeAccountRegistry();

    expect(() =>
      registry.create(
        createAccount({
          ownerType: "platform",
          kind: "customer",
        }),
      ),
    ).toThrow(
      "Platform-owned exchange accounts cannot have customer kind",
    );
  });
});