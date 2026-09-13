import { describe, expect, it } from "vitest";
import { ExchangeSubaccountRegistry, type ExchangeSubaccountRecord } from "../index.js";

function createSubaccount(
  overrides: Partial<ExchangeSubaccountRecord> = {},
): ExchangeSubaccountRecord {
  return {
    id: "exchange-subaccount-1",
    exchangeAccountId: "exchange-account-1",
    name: "spot",
    createdAt: "2026-09-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("ExchangeSubaccountRegistry", () => {
  it("creates and retrieves an exchange subaccount", () => {
    const registry = new ExchangeSubaccountRegistry();
    const subaccount = createSubaccount();

    const created = registry.create(subaccount);

    expect(created).toEqual(subaccount);
    expect(registry.getById(subaccount.id)).toEqual(subaccount);
  });

  it("rejects duplicate subaccount IDs", () => {
    const registry = new ExchangeSubaccountRegistry();

    registry.create(createSubaccount());

    expect(() =>
      registry.create(
        createSubaccount({
          exchangeAccountId: "exchange-account-2",
        }),
      ),
    ).toThrow("Exchange subaccount already exists");
  });

  it("rejects duplicate names within the same exchange account", () => {
    const registry = new ExchangeSubaccountRegistry();

    registry.create(createSubaccount());

    expect(() =>
      registry.create(
        createSubaccount({
          id: "exchange-subaccount-2",
        }),
      ),
    ).toThrow("Exchange subaccount already exists for exchange account and name");
  });

  it("allows the same name for different exchange accounts", () => {
    const registry = new ExchangeSubaccountRegistry();

    registry.create(createSubaccount());

    const second = registry.create(
      createSubaccount({
        id: "exchange-subaccount-2",
        exchangeAccountId: "exchange-account-2",
      }),
    );

    expect(second.exchangeAccountId).toBe("exchange-account-2");
  });

  it("returns null for an unknown subaccount", () => {
    const registry = new ExchangeSubaccountRegistry();

    expect(registry.getById("unknown")).toBeNull();
  });

  it("returns an immutable subaccount", () => {
    const registry = new ExchangeSubaccountRegistry();

    const created = registry.create(createSubaccount());

    expect(() => {
      created.name = "mutated";
    }).toThrow();

    expect(registry.getById(created.id)?.name).toBe("spot");
  });

  it("rejects an empty exchange account ID", () => {
    const registry = new ExchangeSubaccountRegistry();

    expect(() =>
      registry.create(
        createSubaccount({
          exchangeAccountId: "   ",
        }),
      ),
    ).toThrow("Exchange subaccount exchange account ID must not be empty");
  });

  it("rejects an empty name", () => {
    const registry = new ExchangeSubaccountRegistry();

    expect(() =>
      registry.create(
        createSubaccount({
          name: "   ",
        }),
      ),
    ).toThrow("Exchange subaccount name must not be empty");
  });
});
