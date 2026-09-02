import { describe, expect, it } from "vitest";

import { createBitcoinNetworkConfig } from "../network.js";

describe("createBitcoinNetworkConfig", () => {
  it("creates mainnet configuration", () => {
    const result = createBitcoinNetworkConfig("bitcoin-mainnet");

    expect(result).toEqual({
      id: "bitcoin-mainnet",
      name: "Bitcoin",
      bech32Hrp: "bc",
      bip44CoinType: 0,
    });
  });

  it("creates testnet configuration", () => {
    const result = createBitcoinNetworkConfig("bitcoin-testnet");

    expect(result).toEqual({
      id: "bitcoin-testnet",
      name: "Bitcoin Testnet",
      bech32Hrp: "tb",
      bip44CoinType: 1,
    });
  });

  it("returns an immutable configuration", () => {
    const result = createBitcoinNetworkConfig("bitcoin-mainnet");

    expect(Object.isFrozen(result)).toBe(true);
  });

  it("rejects an unsupported network", () => {
    expect(() => createBitcoinNetworkConfig("bitcoin-invalid" as never)).toThrow(
      "Unsupported Bitcoin network",
    );
  });
});
