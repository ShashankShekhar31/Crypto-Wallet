import { describe, expect, it } from "vitest";

import { DefaultAssetRegistry, type AssetDefinition } from "../asset-registry.js";

describe("DefaultAssetRegistry", () => {
  const bitcoin: AssetDefinition = {
    id: "btc",
    symbol: "BTC",
    name: "Bitcoin",
    chain: "bitcoin",
    decimals: 8,
  };

  const solana: AssetDefinition = {
    id: "sol",
    symbol: "SOL",
    name: "Solana",
    chain: "solana",
    decimals: 9,
  };

  it("registers and retrieves an asset by id", () => {
    const registry = new DefaultAssetRegistry();

    registry.register(bitcoin);

    expect(registry.getById("btc")).toEqual(bitcoin);
  });

  it("returns null when an asset does not exist", () => {
    const registry = new DefaultAssetRegistry();

    expect(registry.getById("unknown")).toBeNull();
  });

  it("lists registered assets", () => {
    const registry = new DefaultAssetRegistry();

    registry.register(bitcoin);
    registry.register(solana);

    expect(registry.list()).toEqual([bitcoin, solana]);
  });

  it("rejects duplicate asset ids", () => {
    const registry = new DefaultAssetRegistry();

    registry.register(bitcoin);

    expect(() => registry.register(bitcoin)).toThrow("Asset already registered: btc");
  });

  it("does not expose mutable registry state", () => {
    const registry = new DefaultAssetRegistry();

    registry.register(bitcoin);

    const assets = registry.list();
    assets.pop();

    expect(registry.list()).toEqual([bitcoin]);
  });
});
