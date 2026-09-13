import { describe, expect, it } from "vitest";
import { ExchangeFeeRegistry, type ExchangeFeeRecord } from "../index.js";

function createFee(overrides: Partial<ExchangeFeeRecord> = {}): ExchangeFeeRecord {
  return {
    id: "fee-1",
    tradeId: "trade-1",
    sourceExchangeAssetAccountId: "customer-asset-account",
    feeExchangeAssetAccountId: "fee-asset-account",
    assetId: "usdc",
    amount: "5000000",
    status: "charged",
    reference: "fee-ref-1",
    createdAt: "2026-09-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("ExchangeFeeRegistry", () => {
  it("creates and retrieves a fee", () => {
    const registry = new ExchangeFeeRegistry();
    const fee = createFee();

    const created = registry.create(fee);

    expect(created).toEqual(fee);
    expect(registry.getById(fee.id)).toEqual(fee);
  });

  it("rejects duplicate fee IDs", () => {
    const registry = new ExchangeFeeRegistry();

    registry.create(createFee());

    expect(() =>
      registry.create(
        createFee({
          reference: "fee-ref-2",
        }),
      ),
    ).toThrow("Exchange fee already exists");
  });

  it("rejects duplicate references", () => {
    const registry = new ExchangeFeeRegistry();

    registry.create(createFee());

    expect(() =>
      registry.create(
        createFee({
          id: "fee-2",
        }),
      ),
    ).toThrow("Exchange fee reference already exists");
  });

  it("returns null for an unknown fee", () => {
    const registry = new ExchangeFeeRegistry();

    expect(registry.getById("unknown")).toBeNull();
  });

  it("returns an immutable fee", () => {
    const registry = new ExchangeFeeRegistry();

    const created = registry.create(createFee());

    expect(() => {
      created.status = "reversed";
    }).toThrow();

    expect(registry.getById(created.id)?.status).toBe("charged");
  });

  it("rejects an empty trade ID", () => {
    const registry = new ExchangeFeeRegistry();

    expect(() =>
      registry.create(
        createFee({
          tradeId: "   ",
        }),
      ),
    ).toThrow("Exchange fee trade ID must not be empty");
  });

  it("rejects an empty source account ID", () => {
    const registry = new ExchangeFeeRegistry();

    expect(() =>
      registry.create(
        createFee({
          sourceExchangeAssetAccountId: "   ",
        }),
      ),
    ).toThrow("Exchange fee source asset account ID must not be empty");
  });

  it("rejects an empty fee account ID", () => {
    const registry = new ExchangeFeeRegistry();

    expect(() =>
      registry.create(
        createFee({
          feeExchangeAssetAccountId: "   ",
        }),
      ),
    ).toThrow("Exchange fee fee account ID must not be empty");
  });

  it("rejects identical source and fee accounts", () => {
    const registry = new ExchangeFeeRegistry();

    expect(() =>
      registry.create(
        createFee({
          feeExchangeAssetAccountId: "customer-asset-account",
        }),
      ),
    ).toThrow("Exchange fee source and fee accounts must differ");
  });

  it("rejects an empty asset ID", () => {
    const registry = new ExchangeFeeRegistry();

    expect(() =>
      registry.create(
        createFee({
          assetId: "   ",
        }),
      ),
    ).toThrow("Exchange fee asset ID must not be empty");
  });

  it("rejects a non-positive amount", () => {
    const registry = new ExchangeFeeRegistry();

    expect(() =>
      registry.create(
        createFee({
          amount: "0",
        }),
      ),
    ).toThrow("Exchange fee amount must be positive");
  });

  it("rejects a non-integer amount", () => {
    const registry = new ExchangeFeeRegistry();

    expect(() =>
      registry.create(
        createFee({
          amount: "1.5",
        }),
      ),
    ).toThrow("Exchange fee amount must be positive");
  });

  it("rejects an empty reference", () => {
    const registry = new ExchangeFeeRegistry();

    expect(() =>
      registry.create(
        createFee({
          reference: "   ",
        }),
      ),
    ).toThrow("Exchange fee reference must not be empty");
  });
});
