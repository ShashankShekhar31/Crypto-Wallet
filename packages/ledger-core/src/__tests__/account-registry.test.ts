import { describe, expect, it } from "vitest";

import { LedgerAccountRegistry } from "../account-registry.js";
import type { LedgerAccountRecord } from "../ledger-types.js";

describe("LedgerAccountRegistry", () => {
  const account: LedgerAccountRecord = {
    id: "ledger-account-1",
    walletId: "wallet-1",
    assetId: "btc",
    chain: "bitcoin",
    kind: "asset",
    createdAt: "2026-09-12T00:00:00.000Z",
  };

  it("creates and retrieves a ledger account", () => {
    const registry = new LedgerAccountRegistry();

    const created = registry.create(account);

    expect(created).toEqual(account);
    expect(registry.getById(account.id)).toEqual(account);
  });

  it("rejects duplicate ledger account ids", () => {
    const registry = new LedgerAccountRegistry();

    registry.create(account);

    expect(() => registry.create(account)).toThrow(
      "Ledger account already exists: ledger-account-1",
    );
  });

  it("rejects duplicate account identities", () => {
    const registry = new LedgerAccountRegistry();

    registry.create(account);

    expect(() =>
      registry.create({
        ...account,
        id: "ledger-account-2",
      }),
    ).toThrow("Ledger account already exists for wallet, asset, chain and kind");
  });

  it("returns null for an unknown account", () => {
    const registry = new LedgerAccountRegistry();

    expect(registry.getById("unknown")).toBeNull();
  });

  it("does not expose mutable internal account state", () => {
    const registry = new LedgerAccountRegistry();

    const created = registry.create(account);

    expect(() => {
      created.assetId = "mutated";
    }).toThrow();

    const stored = registry.getById(account.id);

    expect(stored).toEqual(account);
  });
});
