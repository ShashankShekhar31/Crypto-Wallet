import { describe, expect, it } from "vitest";
import { ExchangeTradeRegistry, type ExchangeTradeRecord } from "../index.js";

function createTrade(overrides: Partial<ExchangeTradeRecord> = {}): ExchangeTradeRecord {
  return {
    id: "trade-1",
    buyerExchangeAssetAccountId: "buyer-asset-account",
    sellerExchangeAssetAccountId: "seller-asset-account",
    baseAssetId: "btc",
    quoteAssetId: "usdc",
    baseAmount: "100000",
    quoteAmount: "5000000000",
    priceNumerator: "50000",
    priceDenominator: "1",
    status: "executed",
    reference: "trade-ref-1",
    executedAt: "2026-09-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("ExchangeTradeRegistry", () => {
  it("creates and retrieves a trade", () => {
    const registry = new ExchangeTradeRegistry();
    const trade = createTrade();

    const created = registry.create(trade);

    expect(created).toEqual(trade);
    expect(registry.getById(trade.id)).toEqual(trade);
  });

  it("rejects duplicate trade IDs", () => {
    const registry = new ExchangeTradeRegistry();

    registry.create(createTrade());

    expect(() =>
      registry.create(
        createTrade({
          reference: "trade-ref-2",
        }),
      ),
    ).toThrow("Exchange trade already exists");
  });

  it("rejects duplicate references", () => {
    const registry = new ExchangeTradeRegistry();

    registry.create(createTrade());

    expect(() =>
      registry.create(
        createTrade({
          id: "trade-2",
        }),
      ),
    ).toThrow("Exchange trade reference already exists");
  });

  it("returns null for an unknown trade", () => {
    const registry = new ExchangeTradeRegistry();

    expect(registry.getById("unknown")).toBeNull();
  });

  it("returns an immutable trade", () => {
    const registry = new ExchangeTradeRegistry();

    const created = registry.create(createTrade());

    expect(() => {
      created.status = "reversed";
    }).toThrow();

    expect(registry.getById(created.id)?.status).toBe("executed");
  });

  it("rejects identical buyer and seller accounts", () => {
    const registry = new ExchangeTradeRegistry();

    expect(() =>
      registry.create(
        createTrade({
          sellerExchangeAssetAccountId: "buyer-asset-account",
        }),
      ),
    ).toThrow("Exchange trade buyer and seller asset accounts must differ");
  });

  it("rejects identical base and quote assets", () => {
    const registry = new ExchangeTradeRegistry();

    expect(() =>
      registry.create(
        createTrade({
          quoteAssetId: "btc",
        }),
      ),
    ).toThrow("Exchange trade base and quote assets must differ");
  });

  it("rejects a non-positive base amount", () => {
    const registry = new ExchangeTradeRegistry();

    expect(() =>
      registry.create(
        createTrade({
          baseAmount: "0",
        }),
      ),
    ).toThrow("Exchange trade base amount must be positive");
  });

  it("rejects a non-integer quote amount", () => {
    const registry = new ExchangeTradeRegistry();

    expect(() =>
      registry.create(
        createTrade({
          quoteAmount: "1.5",
        }),
      ),
    ).toThrow("Exchange trade quote amount must be positive");
  });

  it("rejects a non-positive price numerator", () => {
    const registry = new ExchangeTradeRegistry();

    expect(() =>
      registry.create(
        createTrade({
          priceNumerator: "0",
        }),
      ),
    ).toThrow("Exchange trade price numerator must be positive");
  });

  it("rejects a non-positive price denominator", () => {
    const registry = new ExchangeTradeRegistry();

    expect(() =>
      registry.create(
        createTrade({
          priceDenominator: "0",
        }),
      ),
    ).toThrow("Exchange trade price denominator must be positive");
  });

  it("rejects an empty reference", () => {
    const registry = new ExchangeTradeRegistry();

    expect(() =>
      registry.create(
        createTrade({
          reference: "   ",
        }),
      ),
    ).toThrow("Exchange trade reference must not be empty");
  });

  it("rejects an empty execution time", () => {
    const registry = new ExchangeTradeRegistry();

    expect(() =>
      registry.create(
        createTrade({
          executedAt: "   ",
        }),
      ),
    ).toThrow("Exchange trade execution time must not be empty");
  });
});
