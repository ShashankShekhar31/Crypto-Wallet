import { describe, expect, it } from "vitest";

import { getBitcoinTransactionExplorerUrl } from "../explorer.js";

const TXID = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("getBitcoinTransactionExplorerUrl", () => {
  it("returns the mainnet mempool.space transaction URL", () => {
    expect(getBitcoinTransactionExplorerUrl("bitcoin-mainnet", TXID)).toBe(
      `https://mempool.space/tx/${TXID}`,
    );
  });

  it("returns the testnet mempool.space transaction URL", () => {
    expect(getBitcoinTransactionExplorerUrl("bitcoin-testnet", TXID)).toBe(
      `https://mempool.space/testnet/tx/${TXID}`,
    );
  });

  it("normalizes uppercase transaction IDs", () => {
    const uppercaseTxid = TXID.toUpperCase();

    expect(getBitcoinTransactionExplorerUrl("bitcoin-mainnet", uppercaseTxid)).toBe(
      `https://mempool.space/tx/${TXID}`,
    );
  });

  it("rejects malformed transaction IDs", () => {
    expect(() => getBitcoinTransactionExplorerUrl("bitcoin-mainnet", "not-a-txid")).toThrow(
      "Invalid Bitcoin transaction ID",
    );
  });
});
