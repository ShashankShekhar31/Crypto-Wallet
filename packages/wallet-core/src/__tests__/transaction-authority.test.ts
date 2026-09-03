import { describe, expect, it } from "vitest";

import {
  isAuthoritativeSettlementSource,
  type TransactionStateSource,
} from "../transaction-authority.js";

describe("transaction authority", () => {
  it("does not treat client state as authoritative settlement", () => {
    const source: TransactionStateSource = "client";

    expect(isAuthoritativeSettlementSource(source)).toBe(false);
  });

  it("does not treat optimistic state as authoritative settlement", () => {
    const source: TransactionStateSource = "client-optimistic";

    expect(isAuthoritativeSettlementSource(source)).toBe(false);
  });

  it("treats blockchain provider observation as an authoritative source", () => {
    const source: TransactionStateSource = "provider";

    expect(isAuthoritativeSettlementSource(source)).toBe(true);
  });

  it("allows the future ledger domain to be an authoritative source", () => {
    const source: TransactionStateSource = "ledger";

    expect(isAuthoritativeSettlementSource(source)).toBe(true);
  });

  it("rejects unknown sources at the type level", () => {
    const sources: TransactionStateSource[] = ["client", "client-optimistic", "provider", "ledger"];

    expect(sources).toHaveLength(4);
  });
});
