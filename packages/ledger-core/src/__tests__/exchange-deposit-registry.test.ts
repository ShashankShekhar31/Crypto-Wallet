import { describe, expect, it } from "vitest";
import {
  ExchangeDepositRegistry,
  type ExchangeDepositRecord,
} from "../index.js";

function createDeposit(
  overrides: Partial<ExchangeDepositRecord> = {},
): ExchangeDepositRecord {
  return {
    id: "deposit-1",
    exchangeAssetAccountId: "exchange-asset-account-1",
    networkId: "ethereum",
    transactionHash: "0xabc123",
    amount: "1000000",
    status: "detected",
    reference: "deposit-ref-1",
    createdAt: "2026-09-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("ExchangeDepositRegistry", () => {
  it("creates and retrieves a deposit", () => {
    const registry = new ExchangeDepositRegistry();
    const deposit = createDeposit();

    const created = registry.create(deposit);

    expect(created).toEqual(deposit);
    expect(registry.getById(deposit.id)).toEqual(deposit);
  });

  it("rejects duplicate deposit IDs", () => {
    const registry = new ExchangeDepositRegistry();

    registry.create(createDeposit());

    expect(() =>
      registry.create(
        createDeposit({
          reference: "deposit-ref-2",
        }),
      ),
    ).toThrow("Exchange deposit already exists");
  });

  it("rejects duplicate references", () => {
    const registry = new ExchangeDepositRegistry();

    registry.create(createDeposit());

    expect(() =>
      registry.create(
        createDeposit({
          id: "deposit-2",
        }),
      ),
    ).toThrow("Exchange deposit reference already exists");
  });

  it("returns null for an unknown deposit", () => {
    const registry = new ExchangeDepositRegistry();

    expect(registry.getById("unknown")).toBeNull();
  });

  it("returns an immutable deposit", () => {
    const registry = new ExchangeDepositRegistry();

    const created = registry.create(createDeposit());

    expect(() => {
      created.status = "credited";
    }).toThrow();

    expect(registry.getById(created.id)?.status).toBe("detected");
  });

  it("rejects an empty asset account ID", () => {
    const registry = new ExchangeDepositRegistry();

    expect(() =>
      registry.create(
        createDeposit({
          exchangeAssetAccountId: "   ",
        }),
      ),
    ).toThrow(
      "Exchange deposit asset account ID must not be empty",
    );
  });

  it("rejects an empty network ID", () => {
    const registry = new ExchangeDepositRegistry();

    expect(() =>
      registry.create(
        createDeposit({
          networkId: "   ",
        }),
      ),
    ).toThrow("Exchange deposit network ID must not be empty");
  });

  it("rejects an empty transaction hash", () => {
    const registry = new ExchangeDepositRegistry();

    expect(() =>
      registry.create(
        createDeposit({
          transactionHash: "   ",
        }),
      ),
    ).toThrow(
      "Exchange deposit transaction hash must not be empty",
    );
  });

  it("rejects a non-positive amount", () => {
    const registry = new ExchangeDepositRegistry();

    expect(() =>
      registry.create(
        createDeposit({
          amount: "0",
        }),
      ),
    ).toThrow("Exchange deposit amount must be positive");
  });

  it("rejects a non-integer amount", () => {
    const registry = new ExchangeDepositRegistry();

    expect(() =>
      registry.create(
        createDeposit({
          amount: "1.5",
        }),
      ),
    ).toThrow("Exchange deposit amount must be positive");
  });

  it("rejects an empty reference", () => {
    const registry = new ExchangeDepositRegistry();

    expect(() =>
      registry.create(
        createDeposit({
          reference: "   ",
        }),
      ),
    ).toThrow("Exchange deposit reference must not be empty");
  });
});