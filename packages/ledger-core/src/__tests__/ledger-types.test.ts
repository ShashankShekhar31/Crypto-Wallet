import { describe, expect, it } from "vitest";

import type {
  LedgerAccountKind,
  LedgerAccountRecord,
  LedgerSubaccountRecord,
} from "../ledger-types.js";

describe("ledger domain types", () => {
  it("supports explicit ledger account kinds", () => {
    const kinds: LedgerAccountKind[] = ["asset", "liability", "revenue", "expense", "equity"];

    expect(kinds).toHaveLength(5);
  });

  it("models a ledger account", () => {
    const account: LedgerAccountRecord = {
      id: "ledger-account-1",
      walletId: "wallet-1",
      assetId: "btc",
      chain: "bitcoin",
      kind: "asset",
      createdAt: "2026-09-12T00:00:00.000Z",
    };

    expect(account.kind).toBe("asset");
    expect(account.assetId).toBe("btc");
  });

  it("models a ledger subaccount", () => {
    const subaccount: LedgerSubaccountRecord = {
      id: "subaccount-1",
      ledgerAccountId: "ledger-account-1",
      name: "available",
      createdAt: "2026-09-12T00:00:00.000Z",
    };

    expect(subaccount.ledgerAccountId).toBe("ledger-account-1");
    expect(subaccount.name).toBe("available");
  });
});
