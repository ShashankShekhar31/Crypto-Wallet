import { describe, expect, it } from "vitest";
import { ExchangeAssetAccountRegistry, type ExchangeAssetAccountRecord } from "../index.js";

function createAssetAccount(
  overrides: Partial<ExchangeAssetAccountRecord> = {},
): ExchangeAssetAccountRecord {
  return {
    id: "exchange-asset-account-1",
    exchangeAccountId: "exchange-account-1",
    assetId: "btc",
    networkId: "ethereum",
    createdAt: "2026-09-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("ExchangeAssetAccountRegistry", () => {
  it("creates and retrieves an exchange asset account", () => {
    const registry = new ExchangeAssetAccountRegistry();
    const assetAccount = createAssetAccount();

    const created = registry.create(assetAccount);

    expect(created).toEqual(assetAccount);
    expect(registry.getById(assetAccount.id)).toEqual(assetAccount);
  });

  it("rejects duplicate asset-account IDs", () => {
    const registry = new ExchangeAssetAccountRegistry();

    registry.create(createAssetAccount());

    expect(() =>
      registry.create(
        createAssetAccount({
          exchangeAccountId: "exchange-account-2",
        }),
      ),
    ).toThrow("Exchange asset account already exists");
  });

  it("rejects duplicate asset for the same exchange account", () => {
    const registry = new ExchangeAssetAccountRegistry();

    registry.create(createAssetAccount());

    expect(() =>
      registry.create(
        createAssetAccount({
          id: "exchange-asset-account-2",
        }),
      ),
    ).toThrow("Exchange asset account already exists for exchange account and asset");
  });

  it("allows the same asset for different exchange accounts", () => {
    const registry = new ExchangeAssetAccountRegistry();

    registry.create(createAssetAccount());

    const second = registry.create(
      createAssetAccount({
        id: "exchange-asset-account-2",
        exchangeAccountId: "exchange-account-2",
      }),
    );

    expect(second.assetId).toBe("btc");
    expect(second.exchangeAccountId).toBe("exchange-account-2");
  });

  it("allows different assets for the same exchange account", () => {
    const registry = new ExchangeAssetAccountRegistry();

    registry.create(createAssetAccount());

    const second = registry.create(
      createAssetAccount({
        id: "exchange-asset-account-2",
        assetId: "eth",
      }),
    );

    expect(second.exchangeAccountId).toBe("exchange-account-1");
    expect(second.assetId).toBe("eth");
  });

  it("returns null for an unknown asset account", () => {
    const registry = new ExchangeAssetAccountRegistry();

    expect(registry.getById("unknown")).toBeNull();
  });

  it("returns an immutable asset account", () => {
    const registry = new ExchangeAssetAccountRegistry();

    const created = registry.create(createAssetAccount());

    expect(() => {
      created.assetId = "mutated";
    }).toThrow();

    expect(registry.getById(created.id)?.assetId).toBe("btc");
  });

  it("rejects an empty exchange account ID", () => {
    const registry = new ExchangeAssetAccountRegistry();

    expect(() =>
      registry.create(
        createAssetAccount({
          exchangeAccountId: "   ",
        }),
      ),
    ).toThrow("Exchange asset account exchange account ID must not be empty");
  });

  it("rejects an empty asset ID", () => {
    const registry = new ExchangeAssetAccountRegistry();

    expect(() =>
      registry.create(
        createAssetAccount({
          assetId: "   ",
        }),
      ),
    ).toThrow("Exchange asset account asset ID must not be empty");
  });
  it("rejects an empty network ID", () => {
    const registry = new ExchangeAssetAccountRegistry();

    expect(() =>
      registry.create(
        createAssetAccount({
          networkId: "   ",
        }),
      ),
    ).toThrow("Exchange asset account network ID must not be empty");
  });
});
