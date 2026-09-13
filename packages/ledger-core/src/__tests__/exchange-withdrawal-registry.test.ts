import { describe, expect, it } from "vitest";
import {
  ExchangeWithdrawalRegistry,
  type ExchangeWithdrawalRecord,
} from "../index.js";

function createWithdrawal(
  overrides: Partial<ExchangeWithdrawalRecord> = {},
): ExchangeWithdrawalRecord {
  return {
    id: "withdrawal-1",
    exchangeAssetAccountId: "exchange-asset-account-1",
    networkId: "ethereum",
    destination: "0xrecipient",
    amount: "1000000",
    status: "requested",
    reference: "withdrawal-ref-1",
    createdAt: "2026-09-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("ExchangeWithdrawalRegistry", () => {
  it("creates and retrieves a withdrawal", () => {
    const registry = new ExchangeWithdrawalRegistry();
    const withdrawal = createWithdrawal();

    const created = registry.create(withdrawal);

    expect(created).toEqual(withdrawal);
    expect(registry.getById(withdrawal.id)).toEqual(withdrawal);
  });

  it("rejects duplicate withdrawal IDs", () => {
    const registry = new ExchangeWithdrawalRegistry();

    registry.create(createWithdrawal());

    expect(() =>
      registry.create(
        createWithdrawal({
          reference: "withdrawal-ref-2",
        }),
      ),
    ).toThrow("Exchange withdrawal already exists");
  });

  it("rejects duplicate references", () => {
    const registry = new ExchangeWithdrawalRegistry();

    registry.create(createWithdrawal());

    expect(() =>
      registry.create(
        createWithdrawal({
          id: "withdrawal-2",
        }),
      ),
    ).toThrow("Exchange withdrawal reference already exists");
  });

  it("returns null for an unknown withdrawal", () => {
    const registry = new ExchangeWithdrawalRegistry();

    expect(registry.getById("unknown")).toBeNull();
  });

  it("returns an immutable withdrawal", () => {
    const registry = new ExchangeWithdrawalRegistry();

    const created = registry.create(createWithdrawal());

    expect(() => {
      created.status = "approved";
    }).toThrow();

    expect(registry.getById(created.id)?.status).toBe("requested");
  });

  it("rejects an empty asset account ID", () => {
    const registry = new ExchangeWithdrawalRegistry();

    expect(() =>
      registry.create(
        createWithdrawal({
          exchangeAssetAccountId: "   ",
        }),
      ),
    ).toThrow(
      "Exchange withdrawal asset account ID must not be empty",
    );
  });

  it("rejects an empty network ID", () => {
    const registry = new ExchangeWithdrawalRegistry();

    expect(() =>
      registry.create(
        createWithdrawal({
          networkId: "   ",
        }),
      ),
    ).toThrow("Exchange withdrawal network ID must not be empty");
  });

  it("rejects an empty destination", () => {
    const registry = new ExchangeWithdrawalRegistry();

    expect(() =>
      registry.create(
        createWithdrawal({
          destination: "   ",
        }),
      ),
    ).toThrow("Exchange withdrawal destination must not be empty");
  });

  it("rejects a non-positive amount", () => {
    const registry = new ExchangeWithdrawalRegistry();

    expect(() =>
      registry.create(
        createWithdrawal({
          amount: "0",
        }),
      ),
    ).toThrow("Exchange withdrawal amount must be positive");
  });

  it("rejects a non-integer amount", () => {
    const registry = new ExchangeWithdrawalRegistry();

    expect(() =>
      registry.create(
        createWithdrawal({
          amount: "1.5",
        }),
      ),
    ).toThrow("Exchange withdrawal amount must be positive");
  });

  it("rejects an empty reference", () => {
    const registry = new ExchangeWithdrawalRegistry();

    expect(() =>
      registry.create(
        createWithdrawal({
          reference: "   ",
        }),
      ),
    ).toThrow("Exchange withdrawal reference must not be empty");
  });
});