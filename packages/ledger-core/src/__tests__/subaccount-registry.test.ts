import { describe, expect, it } from "vitest";

import { LedgerSubaccountRegistry } from "../subaccount-registry.js";
import type { LedgerSubaccountRecord } from "../ledger-types.js";

describe("LedgerSubaccountRegistry", () => {
  const subaccount: LedgerSubaccountRecord = {
    id: "subaccount-1",
    ledgerAccountId: "ledger-account-1",
    name: "available",
    createdAt: "2026-09-12T00:00:00.000Z",
  };

  it("creates and retrieves a subaccount", () => {
    const registry = new LedgerSubaccountRegistry();

    const created = registry.create(subaccount);

    expect(created).toEqual(subaccount);
    expect(registry.getById(subaccount.id)).toEqual(subaccount);
  });

  it("rejects duplicate subaccount ids", () => {
    const registry = new LedgerSubaccountRegistry();

    registry.create(subaccount);

    expect(() => registry.create(subaccount)).toThrow(
      "Ledger subaccount already exists: subaccount-1",
    );
  });

  it("rejects duplicate subaccount names within the same ledger account", () => {
    const registry = new LedgerSubaccountRegistry();

    registry.create(subaccount);

    expect(() =>
      registry.create({
        ...subaccount,
        id: "subaccount-2",
      }),
    ).toThrow(
      "Ledger subaccount already exists for ledger account and name",
    );
  });

  it("allows the same subaccount name on different ledger accounts", () => {
    const registry = new LedgerSubaccountRegistry();

    registry.create(subaccount);

    const second = registry.create({
      ...subaccount,
      id: "subaccount-2",
      ledgerAccountId: "ledger-account-2",
    });

    expect(second).toEqual({
      ...subaccount,
      id: "subaccount-2",
      ledgerAccountId: "ledger-account-2",
    });
  });

  it("does not expose mutable internal state", () => {
    const registry = new LedgerSubaccountRegistry();

    const created = registry.create(subaccount);

    expect(() => {
      created.name = "mutated";
    }).toThrow();

    expect(registry.getById(subaccount.id)).toEqual(subaccount);
  });

  it("returns null for an unknown subaccount", () => {
    const registry = new LedgerSubaccountRegistry();

    expect(registry.getById("unknown")).toBeNull();
  });
});